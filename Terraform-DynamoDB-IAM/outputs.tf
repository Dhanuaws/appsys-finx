output "workato_dynamodb_role_arn" {
  description = "The ARN of the Workato DynamoDB IAM Role"
  value       = aws_iam_role.workato_dynamodb_role.arn
}

output "workato_dynamodb_role_name" {
  description = "The name of the Workato DynamoDB IAM Role"
  value       = aws_iam_role.workato_dynamodb_role.name
}

output "workato_dynamodb_policy_arn" {
  description = "The ARN of the managed policy attached to the role"
  value       = aws_iam_policy.workato_dynamodb_access.arn
}
