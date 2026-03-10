variable "queue_name" { type = string }

variable "visibility_timeout_seconds" {
  type    = number
  default = 60
}

variable "message_retention_seconds" {
  type    = number
  default = 345600
}

variable "max_message_size" {
  type    = number
  default = 1048576
}

variable "delay_seconds" {
  type    = number
  default = 0
}

variable "receive_wait_time_seconds" {
  type    = number
  default = 0
}

variable "sqs_managed_sse_enabled" {
  type    = bool
  default = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
