
data "aws_caller_identity" "me" {}

locals {
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "s3_bucket" {
  source           = "./modules/s3_bucket"
  bucket_name      = var.bucket_name
  bucket_base_name = var.bucket_base_name
  aws_account_id   = data.aws_caller_identity.me.account_id

  allow_ses_put     = var.enable_ses
  ses_object_prefix = "raw-emails/"

  tags = local.tags
}

module "audit_queue" {
  source     = "./modules/sqs_queue"
  queue_name = "appsys-invi-invoice-audit-events-queue"
  dlq_name   = "appsys-invi-invoice-audit-events-dlq"
  tags       = local.tags
}

resource "aws_iam_group" "admin_group" {
  name = "Appsys-AdminGroup"
}

resource "aws_iam_group_policy_attachment" "admin_group_attach" {
  group      = aws_iam_group.admin_group.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

module "dynamodb" {
  source = "./modules/dynamodb"
  tables = var.tables
  tags   = local.tags
}

module "lambda_app" {
  source = "./modules/lambda_app"

  bucket_name         = module.s3_bucket.bucket_name
  audit_queue_url     = module.audit_queue.queue_url
  audit_queue_arn     = module.audit_queue.queue_arn
  dynamodb_table_arns = module.dynamodb.table_arns
  bedrock_model_arns  = var.bedrock_model_arns

  # Zip paths — point to committed artifacts in the repo
  zip_email_attachment_parser = ".lambda_artifacts/appsys-invi-iac/artifacts/email-attachment-parser.zip"
  zip_nova_extractor          = ".lambda_artifacts/appsys-invi-iac/artifacts/Nova-Extractor-Lambda.zip"
  zip_audit_writer            = ".lambda_artifacts/appsys-invi-iac/artifacts/invoice-audit-writer-lamdba.zip"

  extra_env_email_parser   = var.extra_env_email_parser
  extra_env_nova_extractor = var.extra_env_nova_extractor
  extra_env_audit_writer   = var.extra_env_audit_writer

  tags = local.tags
}

module "s3_notifications" {
  source         = "./modules/s3_notifications"
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
  source              = "./modules/sqs_event_mapping"
  event_source_arn    = module.audit_queue.queue_arn
  consumer_lambda_arn = module.lambda_app.audit_writer_arn
}


module "ses_receiving" {
  count  = var.enable_ses ? 1 : 0
  source = "./modules/ses_receiving"

  rule_set_name = var.ses_rule_set_name
  rule_name     = var.ses_rule_name
  recipients    = var.ses_recipients

  bucket_name   = module.s3_bucket.bucket_name
  object_prefix = "raw-emails/"
}

# ── Cognito User Pool (FinX auth) ─────────────────────────────
resource "aws_cognito_user_pool" "finx" {
  count = var.enable_cognito ? 1 : 0

  name = "finx-invoice-copilot-users"

  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 12
    require_uppercase                = true
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  schema {
    name                = "tenantId"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = "1"
      max_length = "128"
    }
  }

  schema {
    name                = "role"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = "1"
      max_length = "64"
    }
  }

  schema {
    name                = "canViewEmails"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = "4"
      max_length = "5"
    }
  }

  schema {
    name                = "piiAccess"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = "4"
      max_length = "5"
    }
  }

  schema {
    name                = "canApprovePayments"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = "4"
      max_length = "5"
    }
  }

  schema {
    name                = "maxApprovalLimit"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = "1"
      max_length = "20"
    }
  }

  tags = local.tags
}

resource "aws_cognito_user_pool_client" "finx_frontend" {
  count = var.enable_cognito ? 1 : 0

  name         = "finx-frontend-client"
  user_pool_id = aws_cognito_user_pool.finx[0].id

  generate_secret                      = false
  explicit_auth_flows                  = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_PASSWORD_AUTH"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  allowed_oauth_flows_user_pool_client = false
}

# ── Chatbot API — App Runner ───────────────────────────────────
module "chatbot_api" {
  count  = var.enable_chatbot ? 1 : 0
  source = "./modules/chatbot_api"

  service_name        = "finx-chatbot-api"
  ecr_repository_name = "finx-chatbot-api"
  environment         = var.environment
  image_tag           = var.chatbot_image_tag

  # DynamoDB table names (must match the tables var above)
  dynamodb_table_names = [
    "FusionInvoicesTable",
    "RawEmailMetaData",
    "InvoiceAuditLayer",
    "FinXEmailIndex",
    "FinXFraudCases",
  ]
  table_invoices    = "FusionInvoicesTable"
  table_raw_email   = "RawEmailMetaData"
  table_audit_layer = "InvoiceAuditLayer"
  table_email_index = "FinXEmailIndex"
  table_fraud_cases = "FinXFraudCases"

  gsi_invoice_number = "InvoiceNumberIndex"
  gsi_email_id       = "emailId-index"

  s3_bucket = module.s3_bucket.bucket_name

  bedrock_model_id = "amazon.nova-lite-v1:0"

  cognito_user_pool_id  = var.enable_cognito ? aws_cognito_user_pool.finx[0].id : var.cognito_user_pool_id
  cognito_app_client_id = var.enable_cognito ? aws_cognito_user_pool_client.finx_frontend[0].id : var.cognito_app_client_id
  dev_mode              = var.chatbot_api_dev_mode

  tags = local.tags
}

# ── Chatbot UI — App Runner ──────────────────────────────────
module "chatbot_ui" {
  count  = var.enable_chatbot_ui ? 1 : 0
  source = "./modules/chatbot_ui"

  service_name        = "finx-chatbot-ui"
  ecr_repository_name = "finx-chatbot-ui"
  environment         = var.environment
  image_tag           = var.chatbot_ui_image_tag

  # Safely handle the backend URL even if the backend is disabled
  backend_url = join("", module.chatbot_api[*].service_url)

  cognito_user_pool_id  = var.enable_cognito ? aws_cognito_user_pool.finx[0].id : var.cognito_user_pool_id
  cognito_app_client_id = var.enable_cognito ? aws_cognito_user_pool_client.finx_frontend[0].id : var.cognito_app_client_id

  nextauth_secret = var.nextauth_secret
  nextauth_url    = var.nextauth_url

  tags = local.tags
}

# ── Outputs ───────────────────────────────────────────────────
output "chatbot_api_url" {
  description = "App Runner URL for the FinX Chatbot API"
  value       = join("", module.chatbot_api[*].service_url)
}

output "chatbot_ui_url" {
  description = "App Runner URL for the FinX Chatbot UI"
  value       = join("", module.chatbot_ui[*].service_url)
}

output "ecr_repository_url_api" {
  description = "ECR repo for the backend Docker image"
  value       = join("", module.chatbot_api[*].ecr_repository_url)
}

output "ecr_repository_url_ui" {
  description = "ECR repo for the frontend Docker image"
  value       = join("", module.chatbot_ui[*].ecr_repository_url)
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = var.enable_cognito ? aws_cognito_user_pool.finx[0].id : "cognito disabled"
}

output "cognito_app_client_id" {
  description = "Cognito App Client ID for the frontend"
  value       = var.enable_cognito ? aws_cognito_user_pool_client.finx_frontend[0].id : "cognito disabled"
}

# ── Observability ──────────────────────────────────────────────
# Cost-safe: Metric filters (free) + 8 alarms (within 10 free tier)
# + SNS email alerts (1,000 emails/month free)
module "observability" {
  count  = var.enable_observability ? 1 : 0
  source = "./modules/observability"

  alert_email        = var.alert_email
  log_retention_days = 30

  # Lambda function names (must match lambda_app module)
  fn_email_parser   = "email-attachment-parser"
  fn_nova_extractor = "Nova-Extractor-Lambda"
  fn_audit_writer   = "invoice-audit-writer-lamdba"

  # SQS DLQ name (must match audit_queue module)
  dlq_name = "appsys-invi-invoice-audit-events-dlq"

  # App Runner log groups
  apprunner_log_group    = "/aws/apprunner/finx-chatbot-api"
  apprunner_log_group_ui = "/aws/apprunner/finx-chatbot-ui"

  enable_chatbot    = var.enable_chatbot
  enable_chatbot_ui = var.enable_chatbot_ui

  # Do NOT create log groups here — lambda_app and chatbot_api modules own them
  create_log_groups = false

  tags = local.tags
}

output "observability_sns_topic_arn" {
  description = "SNS topic ARN for alerting (subscribe additional endpoints here)"
  value       = var.enable_observability ? module.observability[0].sns_topic_arn : "observability disabled"
}
