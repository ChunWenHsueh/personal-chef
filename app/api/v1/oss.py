import os

import boto3
from botocore.config import Config
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query

load_dotenv()
router = APIRouter()

S3_BUCKET = os.getenv("S3_BUCKET")
S3_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION", "us-east-1")
PRESIGN_EXPIRES_SECONDS = 3600


@router.get("/oss/presign")
def presign_upload(filename: str = Query(min_length=1)):
    if not S3_BUCKET:
        raise HTTPException(status_code=503, detail="S3_BUCKET is not configured")

    content_type_map = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
    }
    ext = filename.split(".")[-1].lower() if "." in filename else "jpg"
    content_type = content_type_map.get(ext, "application/octet-stream")

    client = boto3.client(
        "s3",
        region_name=S3_REGION,
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )
    upload_url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": S3_BUCKET, "Key": filename, "ContentType": content_type},
        ExpiresIn=PRESIGN_EXPIRES_SECONDS,
        HttpMethod="PUT",
    )
    access_url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": filename},
        ExpiresIn=PRESIGN_EXPIRES_SECONDS,
        HttpMethod="GET",
    )

    return {
        "uploadUrl": upload_url,
        "contentType": content_type,
        "accessUrl": access_url,
    }
