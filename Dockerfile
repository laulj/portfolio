# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: Python dependencies (into a virtualenv that is copied over) and
# the webpack bundles. Compiler headers and the JS toolchain stay here, they are
# not part of the published image.
# ---------------------------------------------------------------------------
FROM python:3.12-alpine3.20 AS builder

# Headers needed to build Pillow, plus the JS toolchain used by `npm run collect`
RUN apk add --no-cache gcc musl-dev zlib-dev jpeg-dev nodejs npm

WORKDIR /app

# Python dependencies into a venv that the runtime stage can copy
COPY requirements.txt ./
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Frontend dependencies first, so this layer is reused while the app changes
COPY portfolio/package.json portfolio/package-lock.json ./portfolio/
RUN cd portfolio && npm ci

COPY . .

# settings.py reads SECRET_KEY and DEBUG from the environment, so the manage.py
# steps below need them. They are throwaway build-only values (the runtime gets
# the real ones from the host) and are exported inside this single RUN instead of
# with ENV/ARG, so nothing secret-shaped is baked into a layer and the Docker
# lint rule for ARG/ENV secrets stays quiet. DEBUG stays True so webpack leaves
# the asset URLs to Django's staticfiles storage rather than baking an S3 domain
# into the bundles.
ENV PATH="/opt/venv/bin:$PATH"

RUN cd portfolio \
    && export SECRET_KEY="build-only-not-used-at-runtime" DEBUG=True \
    && npm run collect \
    && python manage.py makemigrations backend \
    && python manage.py collectstatic --noinput

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
FROM python:3.12-alpine3.20

# Libraries Pillow needs at runtime
RUN apk add --no-cache libjpeg-turbo zlib \
    && adduser -D -h /app app

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder --chown=app:app /app /app

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app
USER app
EXPOSE 8000

# Migrations are applied when the container starts (the SQLite database lives
# inside the container), then gunicorn serves the app on $PORT.
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn --chdir ./portfolio portfolio.wsgi:application --bind 0.0.0.0:${PORT}"]
