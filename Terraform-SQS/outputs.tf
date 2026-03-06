output "audit_events_queue_id" {
  description = "The URL of the SQS queue"
  value       = aws_sqs_queue.audit_events_queue.id
}

output "audit_events_queue_arn" {
  description = "The ARN of the SQS queue"
  value       = aws_sqs_queue.audit_events_queue.arn
}
