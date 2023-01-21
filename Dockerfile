# Python and Linux Version 
FROM python:alpine3.17

COPY requirements.txt /app/requirements.txt

# Configure server
RUN set -ex \
    && pip install --upgrade pip \  
    && pip install --no-cache-dir -r /app/requirements.txt \
    && pip install chardet \
    && apk add --no-cache nodejs-current npm

# Working directory
WORKDIR /app

ADD . .

RUN cd portfolio \
    && npm install \
    && npm run build \
    && python3 manage.py makemigrations backend \
    && python3 manage.py migrate \
    #&& python3 manage.py collectstatic --noinput\
    && cd ..\
    && rm .env

EXPOSE $PORT

CMD gunicorn --chdir ./portfolio portfolio.wsgi:application --bind 0.0.0.0:$PORT