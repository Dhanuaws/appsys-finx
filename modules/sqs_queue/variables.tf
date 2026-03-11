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
  default = 262144
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

variable "dlq_name" {
  type    = string
  default = ""
}

variable "max_receive_count" {
  type    = number
  default = 5
}
