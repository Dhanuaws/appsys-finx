output "table_arns" {
  value = { for k, v in aws_dynamodb_table.this : k => v.arn }
}

output "table_names" {
  value = { for k, v in aws_dynamodb_table.this : k => v.name }
}
