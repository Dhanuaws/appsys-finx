# =============================================================================
# SQS QUEUE: appsys-invi-invoice-audit-events-queue
# =============================================================================

resource "aws_sqs_queue" "audit_events_queue" {
  name                       = "appsys-invi-invoice-audit-events-queue"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 0
  visibility_timeout_seconds = 30
  sqs_managed_sse_enabled    = true

  tags = {
    Project     = "AppSys-inVi"
    Environment = "appsys-invi-dev"
  }
}

# --- Queue Policy ---
# Allows Lambda functions (like email-attachment-parser and Nova-Extractor-Lambda)
# to send messages to this queue.
resource "aws_sqs_queue_policy" "audit_events_queue_policy" {
  queue_url = aws_sqs_queue.audit_events_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "sqspolicy"
    Statement = [
      {
        Sid    = "AllowLambdaSend"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.aws_account_id}:root"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.audit_events_queue.arn
      }
    ]
  })
}
