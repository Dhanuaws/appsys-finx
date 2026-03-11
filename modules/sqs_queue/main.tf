resource "aws_sqs_queue" "this" {
  name                       = var.queue_name
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds
  max_message_size           = var.max_message_size
  delay_seconds              = var.delay_seconds
  receive_wait_time_seconds  = var.receive_wait_time_seconds
  sqs_managed_sse_enabled    = var.sqs_managed_sse_enabled

  redrive_policy = var.dlq_name != "" ? jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[0].arn
    maxReceiveCount     = var.max_receive_count
  }) : null

  tags = var.tags
}

resource "aws_sqs_queue" "dlq" {
  count                      = var.dlq_name != "" ? 1 : 0
  name                       = var.dlq_name
  message_retention_seconds  = 1209600 # 14 days for DLQ
  sqs_managed_sse_enabled    = var.sqs_managed_sse_enabled
  tags                       = var.tags
}
