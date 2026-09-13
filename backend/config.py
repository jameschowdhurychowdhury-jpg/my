import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "lantern-couple-secret-key-2026")
    CORS_ALLOWED_ORIGINS = "*"

    ACCOUNTS = {
        "Ame": os.getenv("PASSWORD_AME", "mypassword123"),
        "G...F💕": os.getenv("PASSWORD_GF", "herpassword123")
    }

    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "onetime@2010")

    # Backblaze B2 S3 API Config
    B2_KEY_ID = os.getenv("B2_KEY_ID", "YOUR_B2_KEY_ID")
    B2_APPLICATION_KEY = os.getenv("B2_APPLICATION_KEY", "YOUR_B2_APP_KEY")
    B2_BUCKET_NAME = os.getenv("B2_BUCKET_NAME", "your-chat-bucket")
    B2_ENDPOINT_URL = os.getenv("B2_ENDPOINT_URL", "https://s3.us-east-005.backblazeb2.com")