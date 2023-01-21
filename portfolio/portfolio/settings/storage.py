import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

WEBPACK_LOADER = {
    'DEFAULT': {
        'BUNDLE_DIR_NAME': 'dist/',
        'STATS_FILE': os.path.join(BASE_DIR, 'webpack-stats.json'),
    }
}

# Boto3
DEFAULT_FILE_STORAGE = 'backend.storage_backend.PublicMediaS3Boto3Storage'
STATICFILES_STORAGE = 'backend.storage_backend.StaticS3Boto3Storage'

# AWS
AWS_ACCESS_KEY_ID = os.environ["AWS_ACCESS_KEY_ID"]
AWS_SECRET_ACCESS_KEY = os.environ["AWS_SECRET_ACCESS_KEY"]
AWS_STORAGE_BUCKET_NAME = os.environ["AWS_STORAGE_BUCKET_NAME"]
AWS_DEFAULT_ACL = 'public-read'
AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'
AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}
AWS_LOCATION = 'static'
#STATIC_LOCATION = 'static'
STATIC_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/{AWS_LOCATION}/'

# Django Static Files Directory(s)
STATICFILES_DIRS = (os.path.join(BASE_DIR, 'assets/'),)

# s3 public media settings
#PUBLIC_MEDIA_LOCATION = 'media'
# Base url to serve media files
MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/media/'

# Path where media is stored
MEDIA_ROOT = os.path.join(BASE_DIR, "media/")