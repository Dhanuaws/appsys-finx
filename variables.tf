variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "AppSys-inVi"
}

variable "environment" {
  type    = string
  default = "appsys-invi-dev"
}

variable "enable_ses" {
  type    = bool
  default = true
}

variable "bucket_name" {
  description = "Leave empty to auto-generate a unique name using bucket_base_name + random suffix"
  type        = string
  default     = ""  # Dev account: auto-generated to avoid global name collision
}

variable "bucket_base_name" {
  type    = string
  default = "appsys-finx-dev"
}

variable "ses_rule_set_name" {
  type    = string
  default = "nova-intake-rules"
}

variable "ses_rule_name" {
  type    = string
  default = "nova-intake-rules"
}

variable "ses_recipients" {
  type    = list(string)
  default = ["intake-dev.appsysglobal.com"]
}

variable "tables" {
  type = any
  default = [
    {
      name         = "RawEmailMetaData"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "MessageID"
      range_key    = "ReceivedDate"
      attributes = [
        { name = "MessageID", type = "S" },
        { name = "ReceivedDate", type = "S" }
      ]
    },
    {
      name         = "FusionInvoicesTable"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "DocumentHash"
      attributes = [
        { name = "DocumentHash", type = "S" },
        { name = "InvoiceNumber", type = "S" }
      ]
      global_secondary_indexes = [
        {
          name            = "InvoiceNumberIndex" # Fallback if INVOICE_GSI_NAME is used
          hash_key        = "InvoiceNumber"
          projection_type = "ALL"
        }
      ]
    },
    {
      name         = "InvoiceAuditLayer"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "AuditId"
      attributes = [
        { name = "AuditId", type = "S" }
      ]
    },
    # ── Chatbot tables ──────────────────────────────────────────
    {
      name         = "FinXEmailIndex"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "PK"
      range_key    = "SK"
      attributes = [
        { name = "PK",      type = "S" },
        { name = "SK",      type = "S" },
        { name = "emailId", type = "S" }
      ]
      global_secondary_indexes = [
        {
          name            = "emailId-index"
          hash_key        = "emailId"
          projection_type = "ALL"
        }
      ]
    },
    {
      name         = "FinXFraudCases"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "caseId"
      attributes = [
        { name = "caseId",   type = "S" },
        { name = "tenantId", type = "S" },
        { name = "status",   type = "S" }
      ]
      global_secondary_indexes = [
        {
          name            = "tenantId-status-index"
          hash_key        = "tenantId"
          range_key       = "status"
          projection_type = "ALL"
        }
      ]
    }
  ]
}

variable "bedrock_model_arns" {
  type    = list(string)
  default = ["*"]
}

variable "extra_env_email_parser" {
  type = map(string)
  default = {
    # Phase 3 fix: explicit table name so the Lambda never relies on its own default
    DYNAMODB_TABLE = "RawEmailMetaData"
    APP_NAME       = "AppSys-inVi"
    ENV            = "dev"
  }
}

variable "extra_env_nova_extractor" {
  type = map(string)
  default = {
    # Phase 3 fix: explicit names so Nova Extractor uses the correct GSI (no scan)
    TABLE_NAME       = "FusionInvoicesTable"
    INVOICE_GSI_NAME = "InvoiceNumberIndex"
    MODEL_ID         = "amazon.nova-lite-v1:0"
    ENABLE_IDEMPOTENCY   = "true"
    ENABLE_SCAN_FALLBACK = "false"
    APP_NAME         = "AppSys-inVi"
    ENV              = "dev"
  }
}

variable "extra_env_audit_writer" {
  type = map(string)
  default = {
    # Phase 3 fix: explicit table name for the audit writer
    DYNAMODB_TABLE = "InvoiceAuditLayer"
    APP_NAME       = "AppSys-inVi"
    ENV            = "dev"
  }
}

# ── Chatbot feature flags ──────────────────────────────────────
variable "enable_cognito" {
  description = "Set to true to provision the Cognito User Pool for FinX auth"
  type        = bool
  default     = true
}

variable "enable_chatbot" {
  description = "Set to true to provision ECR + App Runner for the chatbot backend API"
  type        = bool
  default     = true
}

variable "chatbot_api_dev_mode" {
  description = "If true, bypasses Cognito JWT auth in the chatbot backend (useful for initial testing)"
  type        = bool
  default     = true
}

variable "enable_chatbot_ui" {
  description = "Set to true to provision ECR + App Runner for the chatbot frontend UI"
  type        = bool
  default     = true
}

variable "chatbot_image_tag" {
  description = "Docker image tag for the backend API (typically set by CI/CD)"
  type        = string
  default     = "latest"
}

variable "chatbot_ui_image_tag" {
  description = "Docker image tag for the frontend UI (typically set by CI/CD)"
  type        = string
  default     = "latest"
}

variable "nextauth_secret" {
  description = "Secret used for Next-Auth sessions (random string)"
  type        = string
  default     = "dev-secret-replace-me-123"
}

variable "nextauth_url" {
  description = "The public URL of the chatbot UI (for Next-Auth redirects)"
  type        = string
  default     = ""
}

# ── Cognito fallback (used when enable_cognito=false but chatbot=true) ──
variable "cognito_user_pool_id" {
  description = "Existing Cognito User Pool ID (used when enable_cognito=false)"
  type        = string
  default     = ""
}

variable "cognito_app_client_id" {
  description = "Existing Cognito App Client ID (used when enable_cognito=false)"
  type        = string
  default     = ""
}

# ── Observability feature flags ────────────────────────────────
variable "enable_observability" {
  description = "Enable cost-safe CloudWatch observability (alarms, metric filters, SNS)"
  type        = bool
  default     = false
}

variable "alert_email" {
  description = "Email address to receive CloudWatch alarm notifications (empty = no email)"
  type        = string
  default     = ""
}
