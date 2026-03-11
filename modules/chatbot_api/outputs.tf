output "service_url" {
  description = "App Runner service URL for the chatbot API"
  value       = "https://${aws_apprunner_service.chatbot.service_url}"
}

output "service_arn" {
  description = "App Runner service ARN"
  value       = aws_apprunner_service.chatbot.arn
}

output "service_id" {
  description = "App Runner service ID"
  value       = aws_apprunner_service.chatbot.service_id
}

output "ecr_repository_url" {
  description = "ECR repository URL to push Docker images to"
  value       = aws_ecr_repository.chatbot.repository_url
}

output "ecr_repository_name" {
  description = "ECR repository name"
  value       = aws_ecr_repository.chatbot.name
}

output "instance_role_arn" {
  description = "IAM instance role ARN attached to App Runner tasks"
  value       = aws_iam_role.chatbot_instance.arn
}
