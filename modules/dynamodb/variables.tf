variable "tables" {
  type = list(object({
    name         = string
    billing_mode = optional(string, "PAY_PER_REQUEST")

    hash_key  = string
    range_key = optional(string)

    attributes = list(object({
      name = string
      type = string
    }))

    stream_enabled   = optional(bool, false)
    stream_view_type = optional(string)

    sse_enabled = optional(bool, true)
    kms_key_arn = optional(string)

    global_secondary_indexes = optional(list(object({
      name               = string
      hash_key           = string
      range_key          = optional(string)
      projection_type    = optional(string, "ALL")
      non_key_attributes = optional(list(string), [])
    })), [])

    local_secondary_indexes = optional(list(object({
      name               = string
      range_key          = string
      projection_type    = optional(string, "ALL")
      non_key_attributes = optional(list(string), [])
    })), [])
  }))
}

variable "tags" {
  type    = map(string)
  default = {}
}
