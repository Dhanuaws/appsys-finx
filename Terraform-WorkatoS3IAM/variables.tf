variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS Account ID"
  type        = string
  default     = "303289350965"
}

variable "workato_aws_account_id" {
  description = "Workato's AWS Account ID for cross-account trust"
  type        = string
  default     = "353360065216"
}

variable "workato_external_id" {
  description = "The External ID required for Workato to assume the role"
  type        = string
  default     = "workato_iam_external_id_6220965"
}
