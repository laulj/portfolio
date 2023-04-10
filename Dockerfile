# Python and Linux Version 
FROM node:16.20.2
FROM python:3.12-alpine3.20

COPY requirements.txt /app/requirements.txt

# Configure server
RUN set -ex \
    && pip install --upgrade pip \
    && apk add -u zlib-dev jpeg-dev gcc musl-dev \
    && apk add --no-cache npm \
    && pip install --no-cache-dir -r /app/requirements.txt \
    && pip install chardet
     

# Working directory
WORKDIR /app

ADD . .

RUN cd portfolio \
    && npm install \
    && npm run collect \
    && python3 manage.py makemigrations backend \
    && python3 manage.py migrate \
    && python3 manage.py collectstatic --noinput\
    && cd ..\
    && rm .env

EXPOSE $PORT

CMD gunicorn --chdir ./portfolio portfolio.wsgi:application --bind 0.0.0.0:$PORT