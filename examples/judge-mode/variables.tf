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
  default = false
}

variable "bucket_name" {
  type    = string
  default = ""
}

variable "bucket_base_name" {
  type    = string
  default = "appsys-invi"
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
  default = ["project.tools@intake.appsysglobal.com"]
}

variable "tables" {
  type    = any
  default = []
}

variable "bedrock_model_arns" {
  type    = list(string)
  default = ["*"]
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
