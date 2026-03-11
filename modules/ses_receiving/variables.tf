variable "rule_set_name" { type = string }
variable "rule_name" { type = string }
variable "recipients" { type = list(string) }

variable "bucket_name" { type = string }

variable "object_prefix" {
  type    = string
  default = "raw-emails/"
}

variable "tls_policy" {
  type    = string
  default = "Optional"
}

variable "scan_enabled" {
  type    = bool
  default = true
}
