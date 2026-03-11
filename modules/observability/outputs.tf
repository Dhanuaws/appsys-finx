output "sns_topic_arn" {
  description = "SNS alerts topic ARN"
  value       = aws_sns_topic.alerts.arn
}

output "alarm_names" {
  description = "List of all CloudWatch alarm names created"
  value = [
    aws_cloudwatch_metric_alarm.lambda_email_errors.alarm_name,
    aws_cloudwatch_metric_alarm.lambda_nova_errors.alarm_name,
    aws_cloudwatch_metric_alarm.lambda_audit_errors.alarm_name,
    aws_cloudwatch_metric_alarm.sqs_dlq.alarm_name,
    aws_cloudwatch_metric_alarm.apprunner_5xx.alarm_name,
    aws_cloudwatch_metric_alarm.bedrock_errors.alarm_name,
    aws_cloudwatch_metric_alarm.apprunner_slow.alarm_name,
    aws_cloudwatch_metric_alarm.dynamodb_throttle.alarm_name,
  ]
}
