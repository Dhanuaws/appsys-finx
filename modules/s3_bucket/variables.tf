variable "bucket_name" {
  type        = string
  default     = ""
  description = "If empty, a globally-unique name is generated using bucket_base_name + random suffix."
}

variable "bucket_base_name" {
  type    = string
  default = "appsys-invi"
}

variable "force_destroy" {
  type    = bool
  default = false
}

variable "enable_versioning" {
  type    = bool
  default = true
}

variable "enable_sse_s3" {
  type    = bool
  default = true
}

variable "allow_ses_put" {
  type    = bool
  default = true
}

variable "ses_object_prefix" {
  type    = string
  default = "raw-emails/"
}

variable "aws_account_id" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
