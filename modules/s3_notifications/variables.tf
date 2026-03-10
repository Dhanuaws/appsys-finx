variable "bucket_name" { type = string }
variable "aws_account_id" { type = string }

variable "raw_emails_prefix" {
  type    = string
  default = "raw-emails/"
}

variable "email_attachment_prefix" {
  type    = string
  default = "email-attachment/"
}

variable "raw_emails_lambda_arn" { type = string }
variable "raw_emails_lambda_name" { type = string }

variable "attachments_lambda_arn" { type = string }
variable "attachments_lambda_name" { type = string }
