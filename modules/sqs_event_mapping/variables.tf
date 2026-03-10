variable "event_source_arn" { type = string }
variable "consumer_lambda_arn" { type = string }

variable "batch_size" {
  type    = number
  default = 10
}

variable "maximum_batching_window_in_seconds" {
  type    = number
  default = 0
}

variable "enabled" {
  type    = bool
  default = true
}
