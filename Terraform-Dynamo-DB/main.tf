# =============================================================================
# DYNAMODB TABLE 1: FusionInvoicesTable
# =============================================================================

resource "aws_dynamodb_table" "fusion_invoices" {
  name         = "FusionInvoicesTable"
  billing_mode = "PAY_PER_REQUEST"
  table_class  = "STANDARD"
  hash_key     = "InvoiceNumber"
  range_key    = "Supplier"

  attribute {
    name = "InvoiceNumber"
    type = "S"
  }

  attribute {
    name = "Supplier"
    type = "S"
  }

  deletion_protection_enabled = false

  point_in_time_recovery {
    enabled = false
  }

  tags = {
    Project     = "AppSys-inVi"
    Environment = "appsys-invi-dev"
  }
}


# =============================================================================
# DYNAMODB TABLE 2: InvoiceAuditLayer
# =============================================================================

resource "aws_dynamodb_table" "invoice_audit_layer" {
  name         = "InvoiceAuditLayer"
  billing_mode = "PAY_PER_REQUEST"
  table_class  = "STANDARD"
  hash_key     = "AuditId"

  attribute {
    name = "AuditId"
    type = "S"
  }

  attribute {
    name = "Supplier"
    type = "S"
  }

  attribute {
    name = "DetectedAt"
    type = "S"
  }

  attribute {
    name = "RejectCode"
    type = "S"
  }

  # --- GSI 1: Supplier-DetectedAt-index ---
  global_secondary_index {
    name            = "Supplier-DetectedAt-index"
    hash_key        = "Supplier"
    range_key       = "DetectedAt"
    projection_type = "ALL"
  }

  # --- GSI 2: RejectCode-DetectedAt-index ---
  global_secondary_index {
    name            = "RejectCode-DetectedAt-index"
    hash_key        = "RejectCode"
    range_key       = "DetectedAt"
    projection_type = "ALL"
  }

  deletion_protection_enabled = false

  point_in_time_recovery {
    enabled = false
  }

  tags = {
    Project     = "AppSys-inVi"
    Environment = "appsys-invi-dev"
    Component   = "DuplicateAuditDB"
  }
}


# =============================================================================
# DYNAMODB TABLE 3: RawEmailMetaData
# =============================================================================

resource "aws_dynamodb_table" "raw_email_metadata" {
  name         = "RawEmailMetaData"
  billing_mode = "PAY_PER_REQUEST"
  table_class  = "STANDARD"
  hash_key     = "MessageID"
  range_key    = "ReceivedDate"

  attribute {
    name = "MessageID"
    type = "S"
  }

  attribute {
    name = "ReceivedDate"
    type = "S"
  }

  deletion_protection_enabled = false

  point_in_time_recovery {
    enabled = false
  }

  tags = {
    Project     = "AppSys-inVi"
    Environment = "appsys-invi-dev"
  }
}
