output "bucket_name" {
  value = module.s3_bucket.bucket_name
}

output "queue_url" {
  value = module.audit_queue.queue_url
}

output "lambda_names" {
  value = {
    email_attachment_parser = module.lambda_app.email_attachment_parser_name
    nova_extractor          = module.lambda_app.nova_extractor_name
    audit_writer            = module.lambda_app.audit_writer_name
  }
}

output "dynamodb_tables" {
  value = module.dynamodb.table_names
}

output "ses_enabled" {
  value = var.enable_ses
}
