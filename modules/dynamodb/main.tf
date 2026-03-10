locals {
  table_map = { for t in var.tables : t.name => t }
}

resource "aws_dynamodb_table" "this" {
  for_each = local.table_map

  name         = each.value.name
  billing_mode = each.value.billing_mode

  hash_key  = each.value.hash_key
  range_key = try(each.value.range_key, null)

  dynamic "attribute" {
    for_each = each.value.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  stream_enabled   = try(each.value.stream_enabled, false)
  stream_view_type = try(each.value.stream_view_type, null)

  server_side_encryption {
    enabled     = try(each.value.sse_enabled, true)
    kms_key_arn = try(each.value.kms_key_arn, null)
  }

  dynamic "local_secondary_index" {
    for_each = try(each.value.local_secondary_indexes, [])
    content {
      name               = local_secondary_index.value.name
      range_key          = local_secondary_index.value.range_key
      projection_type    = local_secondary_index.value.projection_type
      non_key_attributes = local_secondary_index.value.non_key_attributes
    }
  }

  dynamic "global_secondary_index" {
    for_each = try(each.value.global_secondary_indexes, [])
    content {
      name               = global_secondary_index.value.name
      hash_key           = global_secondary_index.value.hash_key
      range_key          = try(global_secondary_index.value.range_key, null)
      projection_type    = global_secondary_index.value.projection_type
      non_key_attributes = global_secondary_index.value.non_key_attributes
    }
  }

  tags = var.tags
}
