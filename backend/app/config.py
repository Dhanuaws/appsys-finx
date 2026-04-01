"""
FinX Backend Configuration
Loaded from environment variables (injected by App Runner / local .env)
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── AWS ──────────────────────────────────────────────────
    aws_region: str = "us-east-1"
    aws_account_id: str = ""

    # ── DynamoDB Tables ────────────────────────────────────────
    table_invoices: str = "FusionInvoicesTable"
    table_raw_email: str = "RawEmailMetaData"
    table_audit_layer: str = "InvoiceAuditLayer"
    table_email_index: str = "FinXEmailIndex"
    table_fraud_cases: str = "FinXFraudCases"

    # GSI names
    gsi_invoice_number: str = "InvoiceNumberIndex"
    gsi_status_date: str = "StatusDateIndex"
    gsi_tenant_status: str = "TenantStatusIndex"
    gsi_email_id: str = "emailId-index"

    # ── S3 ────────────────────────────────────────────────────
    s3_bucket: str = ""  # Required — set S3_BUCKET env var
    s3_signed_url_ttl: int = 43200  # 12 hours

    # ── Bedrock / Nova Lite ────────────────────────────────────
    bedrock_model_id: str = "amazon.nova-lite-v1:0"
    bedrock_region: str = "us-east-1"
    max_tokens: int = 4096

    # ── Auth / Cognito ─────────────────────────────────────────
    cognito_region: str = "us-east-1"
    cognito_user_pool_id: str = ""
    cognito_app_client_id: str = ""
    jwt_algorithms: list[str] = ["RS256"]
    # Set to True in local dev only (skips Cognito JWT validation)
    dev_mode: bool = False
    dev_tenant_id: str = "tenant-appsys-dev"

    # ── App ───────────────────────────────────────────────────
    app_name: str = "FinX-Chatbot-Backend"
    environment: str = "dev"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
