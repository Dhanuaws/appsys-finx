# ── chatbot_api module variables ──────────────────────────────

variable "service_name" {
  description = "App Runner service name"
  type        = string
  default     = "finx-chatbot-api"
}

variable "ecr_repository_name" {
  description = "ECR repository name for the chatbot Docker image"
  type        = string
  default     = "finx-chatbot-api"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "environment" {
  description = "Environment name (dev / staging / prod)"
  type        = string
  default     = "dev"
}

# ── Compute ───────────────────────────────────────────────────
variable "cpu" {
  description = "App Runner CPU (256 | 512 | 1024 | 2048 | 4096)"
  type        = string
  default     = "512"
}

variable "memory" {
  description = "App Runner memory in MB (512 | 1024 | 2048 | 3072 | 4096 | 6144 | 8192 | 10240 | 12288)"
  type        = string
  default     = "1024"
}

variable "min_instances" {
  description = "Minimum App Runner instances"
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum App Runner instances"
  type        = number
  default     = 5
}

# ── DynamoDB ──────────────────────────────────────────────────
variable "dynamodb_table_names" {
  description = "List of DynamoDB table names the chatbot API needs access to"
  type        = list(string)
  default = [
    "FusionInvoicesTable",
    "RawEmailMetaData",
    "InvoiceAuditLayer",
    "FinXEmailIndex",
    "FinXFraudCases",
  ]
}

variable "table_invoices" {
  type    = string
  default = "FusionInvoicesTable"
}

variable "table_raw_email" {
  type    = string
  default = "RawEmailMetaData"
}

variable "table_audit_layer" {
  type    = string
  default = "InvoiceAuditLayer"
}

variable "table_email_index" {
  type    = string
  default = "FinXEmailIndex"
}

variable "table_fraud_cases" {
  type    = string
  default = "FinXFraudCases"
}

# ── GSI names ─────────────────────────────────────────────────
variable "gsi_invoice_number" {
  type    = string
  default = "InvoiceNumberIndex"
}

variable "gsi_email_id" {
  type    = string
  default = "emailId-index"
}

# ── S3 ────────────────────────────────────────────────────────
variable "s3_bucket" {
  description = "S3 bucket for email evidence and attachments"
  type        = string
  default     = "amzn-s3-nova-bucket"
}

variable "tenant_email_prefix" {
  description = "S3 prefix for tenant email data"
  type        = string
  default     = ""
}

# ── Bedrock ───────────────────────────────────────────────────
variable "bedrock_model_id" {
  type    = string
  default = "amazon.nova-lite-v1:0"
}

# ── Cognito ───────────────────────────────────────────────────
variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for JWT validation"
  type        = string
  default     = ""
}

variable "cognito_app_client_id" {
  description = "Cognito App Client ID"
  type        = string
  default     = ""
}

# ── Extra env vars ────────────────────────────────────────────
variable "extra_env_vars" {
  description = "Additional environment variables to inject"
  type        = map(string)
  default     = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}
