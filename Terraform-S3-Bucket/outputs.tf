output "s3_bucket_id" {
  description = "The name of the S3 bucket"
  value       = aws_s3_bucket.nova_bucket.id
}

output "s3_bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = aws_s3_bucket.nova_bucket.arn
}

output "s3_bucket_region" {
  description = "The AWS region of the S3 bucket"
  value       = aws_s3_bucket.nova_bucket.region
}

output "s3_bucket_domain_name" {
  description = "The bucket domain name (e.g. amzn-s3-nova-bucket.s3.amazonaws.com)"
  value       = aws_s3_bucket.nova_bucket.bucket_domain_name
}
