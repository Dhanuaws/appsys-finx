provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "me" {}

locals {
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "s3_bucket" {
  source           = "../../modules/s3_bucket"
  bucket_name      = var.bucket_name
  bucket_base_name = var.bucket_base_name
  aws_account_id   = data.aws_caller_identity.me.account_id

  allow_ses_put     = var.enable_ses
  ses_object_prefix = "raw-emails/"

  tags = local.tags
}

module "audit_queue" {
  source     = "../../modules/sqs_queue"
  queue_name = "appsys-invi-invoice-audit-events-queue"
  tags       = local.tags
}

module "dynamodb" {
  source = "../../modules/dynamodb"
  tables = var.tables
  tags   = local.tags
}

module "lambda_app" {
  source = "../../modules/lambda_app"

  bucket_name         = module.s3_bucket.bucket_name
  audit_queue_url     = module.audit_queue.queue_url
  audit_queue_arn     = module.audit_queue.queue_arn
  dynamodb_table_arns = module.dynamodb.table_arns
  bedrock_model_arns  = var.bedrock_model_arns

  extra_env_email_parser   = var.extra_env_email_parser
  extra_env_nova_extractor = var.extra_env_nova_extractor
  extra_env_audit_writer   = var.extra_env_audit_writer

  tags = local.tags
}

module "s3_notifications" {
  source         = "../../modules/s3_notifications"
  bucket_name    = module.s3_bucket.bucket_name
  aws_account_id = data.aws_caller_identity.me.account_id

  raw_emails_prefix       = "raw-emails/"
  email_attachment_prefix = "email-attachment/"

  raw_emails_lambda_arn  = module.lambda_app.email_attachment_parser_arn
  raw_emails_lambda_name = module.lambda_app.email_attachment_parser_name

  attachments_lambda_arn  = module.lambda_app.nova_extractor_arn
  attachments_lambda_name = module.lambda_app.nova_extractor_name
}

module "audit_queue_mapping" {
  source              = "../../modules/sqs_event_mapping"
  event_source_arn    = module.audit_queue.queue_arn
  consumer_lambda_arn = module.lambda_app.audit_writer_arn
}

module "ses_receiving" {
  count  = var.enable_ses ? 1 : 0
  source = "../../modules/ses_receiving"

  rule_set_name = var.ses_rule_set_name
  rule_name     = var.ses_rule_name
  recipients    = var.ses_recipients

  bucket_name   = module.s3_bucket.bucket_name
  object_prefix = "raw-emails/"
}
