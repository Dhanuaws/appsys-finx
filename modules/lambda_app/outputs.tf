output "email_attachment_parser_arn" {
  value = aws_lambda_function.email_parser.arn
}

output "email_attachment_parser_name" {
  value = aws_lambda_function.email_parser.function_name
}

output "nova_extractor_arn" {
  value = aws_lambda_function.nova_extractor.arn
}

output "nova_extractor_name" {
  value = aws_lambda_function.nova_extractor.function_name
}

output "audit_writer_arn" {
  value = aws_lambda_function.audit_writer.arn
}

output "audit_writer_name" {
  value = aws_lambda_function.audit_writer.function_name
}
