from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage


class StaticS3Boto3Storage(S3Boto3Storage):
    bucket_name = 'portfolio-serve'
    location = 'static'
    default_acl = 'public-read'


class PublicMediaS3Boto3Storage(S3Boto3Storage):
    bucket_name = 'portfolio-serve'
    location = 'media'
    default_acl = 'public-read'


class PrivateMediaS3Boto3Storage(S3Boto3Storage):
    location = 'private'
    default_acl = 'private'
    file_overwrite = False
    custom_domain = False