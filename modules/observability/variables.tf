variable "alert_email" {
  description = "Email address for CloudWatch alarm notifications (leave empty to skip SNS subscription)"
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days (keep low to avoid storage costs)"
  type        = number
  default     = 30
}

variable "create_log_groups" {
  description = "Set to false if log groups are already managed by lambda_app or chatbot_api modules (prevents duplicate resource error)"
  type        = bool
  default     = false
}

# ── Lambda function names ─────────────────────────────────────
variable "fn_email_parser" {
  description = "Name of the email-attachment-parser Lambda"
  type        = string
  default     = "email-attachment-parser"
}

variable "fn_nova_extractor" {
  description = "Name of the Nova-Extractor-Lambda"
  type        = string
  default     = "Nova-Extractor-Lambda"
}

variable "fn_audit_writer" {
  description = "Name of the invoice-audit-writer Lambda"
  type        = string
  default     = "invoice-audit-writer-lamdba"
}

# ── SQS ───────────────────────────────────────────────────────
variable "dlq_name" {
  description = "Name of the SQS Dead Letter Queue to monitor"
  type        = string
  default     = "appsys-invi-invoice-audit-events-dlq"
}

# ── App Runner ────────────────────────────────────────────────
variable "apprunner_log_group" {
  description = "CloudWatch log group name for the App Runner chatbot service"
  type        = string
  default     = "/aws/apprunner/finx-chatbot-api"
}

variable "tags" {
  type    = map(string)
  default = {}
}
