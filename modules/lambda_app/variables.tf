variable "bucket_name" { type = string }

variable "audit_queue_url" { type = string }
variable "audit_queue_arn" { type = string }

variable "dynamodb_table_arns" {
  type    = map(string)
  default = {}
}

variable "bedrock_model_arns" {
  type    = list(string)
  default = ["*"]
}

variable "runtime" {
  type    = string
  default = "python3.12"
}

variable "fn_email_attachment_parser" {
  type    = string
  default = "email-attachment-parser"
}

variable "fn_nova_extractor" {
  type    = string
  default = "Nova-Extractor-Lambda"
}

variable "fn_audit_writer" {
  type    = string
  default = "invoice-audit-writer-lamdba"
}

variable "handler_email_attachment_parser" {
  type    = string
  default = "lambda_function.lambda_handler"
}

variable "handler_nova_extractor" {
  type    = string
  default = "lambda_nova_extractor_trigger.lambda_handler"
}

variable "handler_audit_writer" {
  type    = string
  default = "lambda_function.lambda_handler"
}

variable "zip_email_attachment_parser" {
  type    = string
  default = "../../artifacts/email-attachment-parser.zip"
}

variable "zip_nova_extractor" {
  type    = string
  default = "../../artifacts/Nova-Extractor-Lambda.zip"
}

variable "zip_audit_writer" {
  type    = string
  default = "../../artifacts/invoice-audit-writer-lamdba.zip"
}

variable "memory_size" {
  type    = number
  default = 128
}

variable "timeout" {
  type    = number
  default = 45
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "extra_env_email_parser" {
  type    = map(string)
  default = {}
}

variable "extra_env_nova_extractor" {
  type    = map(string)
  default = {}
}

variable "extra_env_audit_writer" {
  type    = map(string)
  default = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}
