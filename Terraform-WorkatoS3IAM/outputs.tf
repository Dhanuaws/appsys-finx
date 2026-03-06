output "workato_s3_role_arn" {
  description = "The ARN of the Workato S3 Integration IAM Role"
  value       = aws_iam_role.workato_s3_role.arn
}

output "workato_s3_role_name" {
  description = "The name of the Workato S3 Integration IAM Role"
  value       = aws_iam_role.workato_s3_role.name
}

output "workato_s3_policy_arn" {
  description = "The ARN of the managed policy attached to the role"
  value       = aws_iam_policy.workato_s3_access.arn
}
