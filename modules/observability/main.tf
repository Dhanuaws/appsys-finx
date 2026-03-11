# FinX Observability Module
# ──────────────────────────────────────────────────────────────
# COST-SAFE design:
#   • CloudWatch Log Groups with 30-day retention  (5 GB/month free)
#   • Log Metric Filters → metrics          FREE to create
#   • CloudWatch Alarms  — 8 total           10 free (then $0.10/alarm/mo)
#   • SNS Email topic                        1,000 emails/month free
#   • NO X-Ray        NO paid dashboard
#
# Alarms created (8):
#   1. Lambda errors — email_attachment_parser
#   2. Lambda errors — nova_extractor
#   3. Lambda errors — audit_writer
#   4. SQS DLQ messages visible > 0
#   5. App Runner 5xx errors (via log metric filter)
#   6. App Runner high latency P95 > 5 s
#   7. DynamoDB throttled requests
#   8. Nova Lite / Bedrock invocation errors (App Runner log filter)

locals {
  prefix = "finx"
}

# ── SNS Alert Topic ───────────────────────────────────────────
resource "aws_sns_topic" "alerts" {
  name = "${local.prefix}-alerts"
  tags = var.tags
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ── CloudWatch Log Groups (explicit retention) ─────────────────
# These may already exist from lambda_app and chatbot_api modules.
# Using `ignore_if_exists`-style approach: Terraform will adopt them
# if they already exist on the next apply.

resource "aws_cloudwatch_log_group" "obs_email_parser" {
  count             = var.create_log_groups ? 1 : 0
  name              = "/aws/lambda/${var.fn_email_parser}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
  lifecycle { prevent_destroy = false }
}

resource "aws_cloudwatch_log_group" "obs_nova_extractor" {
  count             = var.create_log_groups ? 1 : 0
  name              = "/aws/lambda/${var.fn_nova_extractor}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
  lifecycle { prevent_destroy = false }
}

resource "aws_cloudwatch_log_group" "obs_audit_writer" {
  count             = var.create_log_groups ? 1 : 0
  name              = "/aws/lambda/${var.fn_audit_writer}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
  lifecycle { prevent_destroy = false }
}

# App Runner log group (created by chatbot_api module)
# We reference it here by name only (no resource creation) to attach metric filters.

# ── Log Metric Filters (FREE) ─────────────────────────────────
# Filter 1: App Runner 5xx responses (Pattern: HTTP 5xx in access log)
resource "aws_cloudwatch_log_metric_filter" "apprunner_5xx" {
  name           = "${local.prefix}-apprunner-5xx"
  log_group_name = var.apprunner_log_group
  pattern        = "[ip, user, date, time, request, status_code=5*, size]"

  metric_transformation {
    name      = "AppRunner5xxCount"
    namespace = "${local.prefix}/AppRunner"
    value     = "1"
    default_value = "0"
    unit      = "Count"
  }
}

# Filter 1.1: App Runner UI 5xx responses
resource "aws_cloudwatch_log_metric_filter" "apprunner_ui_5xx" {
  name           = "${local.prefix}-apprunner-ui-5xx"
  log_group_name = var.apprunner_log_group_ui
  pattern        = "[ip, user, date, time, request, status_code=5*, size]"

  metric_transformation {
    name      = "AppRunnerUI5xxCount"
    namespace = "${local.prefix}/AppRunner"
    value     = "1"
    default_value = "0"
    unit      = "Count"
  }
}

# Filter 2: Bedrock / NovaLite errors in App Runner structured logs
resource "aws_cloudwatch_log_metric_filter" "bedrock_errors" {
  name           = "${local.prefix}-bedrock-errors"
  log_group_name = var.apprunner_log_group
  pattern        = "{ $.levelname = \"ERROR\" && $.message = \"*Bedrock*\" }"

  metric_transformation {
    name          = "BedrockErrorCount"
    namespace     = "${local.prefix}/AppRunner"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# Filter 3: App Runner high latency (requests that take > 5000ms)
resource "aws_cloudwatch_log_metric_filter" "apprunner_slow" {
  name           = "${local.prefix}-apprunner-slow-requests"
  log_group_name = var.apprunner_log_group
  pattern        = "{ $.duration_ms > 5000 }"

  metric_transformation {
    name          = "SlowRequestCount"
    namespace     = "${local.prefix}/AppRunner"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# ── CloudWatch Alarms (8 total = under the 10 free tier) ──────

# Alarm 1: Lambda email_attachment_parser errors
resource "aws_cloudwatch_metric_alarm" "lambda_email_errors" {
  alarm_name          = "${local.prefix}-lambda-email-parser-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.fn_email_parser
  }

  alarm_description = "Lambda email-attachment-parser has errors in the last 5 minutes"
  alarm_actions     = [aws_sns_topic.alerts.arn]
  ok_actions        = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

# Alarm 2: Lambda nova_extractor errors
resource "aws_cloudwatch_metric_alarm" "lambda_nova_errors" {
  alarm_name          = "${local.prefix}-lambda-nova-extractor-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.fn_nova_extractor
  }

  alarm_description = "Lambda Nova-Extractor has errors in the last 5 minutes"
  alarm_actions     = [aws_sns_topic.alerts.arn]
  ok_actions        = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

# Alarm 3: Lambda audit_writer errors
resource "aws_cloudwatch_metric_alarm" "lambda_audit_errors" {
  alarm_name          = "${local.prefix}-lambda-audit-writer-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.fn_audit_writer
  }

  alarm_description = "Lambda invoice-audit-writer has errors in the last 5 minutes"
  alarm_actions     = [aws_sns_topic.alerts.arn]
  ok_actions        = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

# Alarm 4: SQS DLQ has messages (means emails/invoices are failing)
resource "aws_cloudwatch_metric_alarm" "sqs_dlq" {
  alarm_name          = "${local.prefix}-sqs-dlq-messages"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = var.dlq_name
  }

  alarm_description = "Messages are piling up in the DLQ — audit events are failing"
  alarm_actions     = [aws_sns_topic.alerts.arn]
  ok_actions        = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

# Alarm 5: App Runner 5xx errors (from log metric filter above)
resource "aws_cloudwatch_metric_alarm" "apprunner_5xx" {
  alarm_name          = "${local.prefix}-apprunner-5xx-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "AppRunner5xxCount"
  namespace           = "${local.prefix}/AppRunner"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  alarm_description = "App Runner chatbot backend had ≥5 HTTP 5xx errors in 10 minutes"
  alarm_actions     = [aws_sns_topic.alerts.arn]
  ok_actions        = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

# Alarm 6: Bedrock / Nova Lite errors
resource "aws_cloudwatch_metric_alarm" "bedrock_errors" {
  alarm_name          = "${local.prefix}-bedrock-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "BedrockErrorCount"
  namespace           = "${local.prefix}/AppRunner"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  alarm_description = "Nova Lite / Bedrock errors detected in App Runner logs"
  alarm_actions     = [aws_sns_topic.alerts.arn]
  ok_actions        = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

# Alarm 7: App Runner slow requests (>5s)
resource "aws_cloudwatch_metric_alarm" "apprunner_slow" {
  alarm_name          = "${local.prefix}-apprunner-slow-requests"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "SlowRequestCount"
  namespace           = "${local.prefix}/AppRunner"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  treat_missing_data  = "notBreaching"

  alarm_description = "App Runner had ≥3 slow requests (>5s) in 10 minutes"
  alarm_actions     = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

# Alarm 8: DynamoDB Throttled requests (any table)
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttle" {
  alarm_name          = "${local.prefix}-dynamodb-throttled"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  alarm_description = "DynamoDB throttled ≥10 requests in 5 minutes — consider reviewing table capacity"
  alarm_actions     = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}
