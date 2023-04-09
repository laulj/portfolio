import os
from storages.backends.s3boto3 import S3Boto3Storage
from dotenv import load_dotenv

# load .env
load_dotenv()

if os.environ["DEBUG"] == "False":
    class StaticS3Boto3Storage(S3Boto3Storage):
        bucket_name = os.environ["AWS_STORAGE_BUCKET_NAME"]
        location = 'static'
        default_acl = 'public-read'


    class PublicMediaS3Boto3Storage(S3Boto3Storage):
        bucket_name = os.environ["AWS_STORAGE_BUCKET_NAME"]
        location = 'media'
        default_acl = 'public-read'


    class PrivateMediaS3Boto3Storage(S3Boto3Storage):
        location = 'private'
        default_acl = 'private'
        file_overwrite = False
        custom_domain = False