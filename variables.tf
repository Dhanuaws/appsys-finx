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
  default = [
    {
      name         = "appsys-invi-nova-intake-emails-table"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "email_id"
      attributes = [
        { name = "email_id", type = "S" }
      ]
    },
    {
      name         = "appsys-invi-nova-extracted-data-table"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "extraction_id"
      attributes = [
        { name = "extraction_id", type = "S" }
      ]
    }
  ]
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
