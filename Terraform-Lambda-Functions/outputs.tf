output "email_attachment_parser_arn" {
  description = "ARN of the email-attachment-parser Lambda function"
  value       = aws_lambda_function.email_attachment_parser.arn
}

output "nova_extractor_lambda_arn" {
  description = "ARN of the Nova-Extractor-Lambda function"
  value       = aws_lambda_function.nova_extractor_lambda.arn
}

output "invoice_audit_writer_arn" {
  description = "ARN of the invoice-audit-writer-lamdba function"
  value       = aws_lambda_function.invoice_audit_writer.arn
}

output "email_attachment_parser_role_arn" {
  description = "ARN of the IAM role for email-attachment-parser"
  value       = aws_iam_role.email_attachment_parser.arn
}

output "nova_extractor_lambda_role_arn" {
  description = "ARN of the IAM role for Nova-Extractor-Lambda"
  value       = aws_iam_role.nova_extractor_lambda.arn
}

output "invoice_audit_writer_role_arn" {
  description = "ARN of the IAM role for invoice-audit-writer-lamdba"
  value       = aws_iam_role.invoice_audit_writer.arn
}
