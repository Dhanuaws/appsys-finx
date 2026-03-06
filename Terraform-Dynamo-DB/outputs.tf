# =============================================================================
# FusionInvoicesTable
# =============================================================================

output "fusion_invoices_table_name" {
  description = "Name of the FusionInvoicesTable"
  value       = aws_dynamodb_table.fusion_invoices.name
}

output "fusion_invoices_table_arn" {
  description = "ARN of the FusionInvoicesTable"
  value       = aws_dynamodb_table.fusion_invoices.arn
}


# =============================================================================
# InvoiceAuditLayer
# =============================================================================

output "invoice_audit_layer_table_name" {
  description = "Name of the InvoiceAuditLayer table"
  value       = aws_dynamodb_table.invoice_audit_layer.name
}

output "invoice_audit_layer_table_arn" {
  description = "ARN of the InvoiceAuditLayer table"
  value       = aws_dynamodb_table.invoice_audit_layer.arn
}


# =============================================================================
# RawEmailMetaData
# =============================================================================

output "raw_email_metadata_table_name" {
  description = "Name of the RawEmailMetaData table"
  value       = aws_dynamodb_table.raw_email_metadata.name
}

output "raw_email_metadata_table_arn" {
  description = "ARN of the RawEmailMetaData table"
  value       = aws_dynamodb_table.raw_email_metadata.arn
}
