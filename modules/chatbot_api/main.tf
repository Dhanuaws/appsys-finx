# ── FinX Chatbot API — AWS App Runner Module ──────────────────
# Deploys the FastAPI backend container to App Runner.
# Pulls image from ECR. IAM role grants DynamoDB, S3, and Bedrock.
#
# Architecture:
#   ECR → App Runner → (DynamoDB, S3, Bedrock, Cognito)

data "aws_caller_identity" "chatbot" {}
data "aws_region" "chatbot" {}

locals {
  account_id = data.aws_caller_identity.chatbot.account_id
  region     = data.aws_region.chatbot.name
  ecr_url    = "${local.account_id}.dkr.ecr.${local.region}.amazonaws.com/${var.ecr_repository_name}"
}

# ── ECR Repository ────────────────────────────────────────────
resource "aws_ecr_repository" "chatbot" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_ecr_lifecycle_policy" "chatbot" {
  repository = aws_ecr_repository.chatbot.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep only last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = {
        type = "expire"
      }
    }]
  })
}


# ── IAM Role for App Runner instance ─────────────────────────
data "aws_iam_policy_document" "assume_apprunner" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "chatbot_instance" {
  name               = "${var.service_name}-instance-role"
  assume_role_policy = data.aws_iam_policy_document.assume_apprunner.json
  tags               = var.tags
}

data "aws_iam_policy_document" "chatbot_instance_policy" {
  # DynamoDB — all 5 chatbot tables
  statement {
    sid       = "DynamoDBAccess"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan", "dynamodb:BatchGetItem", "dynamodb:BatchWriteItem"]
    resources = concat(
      [for name in var.dynamodb_table_names : "arn:aws:dynamodb:${local.region}:${local.account_id}:table/${name}"],
      [for name in var.dynamodb_table_names : "arn:aws:dynamodb:${local.region}:${local.account_id}:table/${name}/index/*"]
    )
  }

  # S3 — email evidence bucket (read) + attachments prefix (read)
  statement {
    sid     = "S3ReadEvidence"
    actions = ["s3:GetObject"]
    resources = [
      "arn:aws:s3:::${var.s3_bucket}/${var.tenant_email_prefix}*",
    ]
  }

  # S3 — pre-signed URL generation (no s3 permission needed; client does it)
  # Bedrock — Nova Lite
  statement {
    sid     = "BedrockInvoke"
    actions = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
    resources = ["arn:aws:bedrock:${local.region}::foundation-model/amazon.nova-lite-v1:0"]
  }

  # Bedrock — Converse API (uses different action)
  statement {
    sid     = "BedrockConverse"
    actions = ["bedrock:Converse", "bedrock:ConverseStream"]
    resources = ["arn:aws:bedrock:${local.region}::foundation-model/amazon.nova-lite-v1:0"]
  }

  # CloudWatch — write app logs
  statement {
    sid     = "CloudWatchLogs"
    actions = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/apprunner/${var.service_name}*"]
  }
}

resource "aws_iam_role_policy" "chatbot_instance_policy" {
  name   = "${var.service_name}-instance-policy"
  role   = aws_iam_role.chatbot_instance.id
  policy = data.aws_iam_policy_document.chatbot_instance_policy.json
}

# ── IAM Role for ECR pull (App Runner access role) ────────────
data "aws_iam_policy_document" "assume_apprunner_access" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "chatbot_access" {
  name               = "${var.service_name}-access-role"
  assume_role_policy = data.aws_iam_policy_document.assume_apprunner_access.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "ecr_readonly" {
  role       = aws_iam_role.chatbot_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# ── App Runner Service ────────────────────────────────────────
resource "aws_apprunner_service" "chatbot" {
  service_name = var.service_name

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.chatbot_access.arn
    }

    image_repository {
      image_identifier      = "${local.ecr_url}:${var.image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = "8000"

        runtime_environment_variables = merge(
          {
            # Core AWS config
            AWS_REGION    = local.region
            ENVIRONMENT   = var.environment

            # DynamoDB Tables
            TABLE_INVOICES    = var.table_invoices
            TABLE_RAW_EMAIL   = var.table_raw_email
            TABLE_AUDIT_LAYER = var.table_audit_layer
            TABLE_EMAIL_INDEX = var.table_email_index
            TABLE_FRAUD_CASES = var.table_fraud_cases

            # GSI names
            GSI_INVOICE_NUMBER = var.gsi_invoice_number
            GSI_EMAIL_ID       = var.gsi_email_id

            # S3
            S3_BUCKET = var.s3_bucket

            # Bedrock
            BEDROCK_MODEL_ID = var.bedrock_model_id
            BEDROCK_REGION   = local.region

            # Cognito
            COGNITO_REGION        = local.region
            COGNITO_USER_POOL_ID  = var.cognito_user_pool_id
            COGNITO_APP_CLIENT_ID = var.cognito_app_client_id

            # App
            APP_NAME = "FinX-Chatbot-Backend"
            DEV_MODE = "false"
          },
          var.extra_env_vars
        )
      }
    }

    auto_deployments_enabled = false
  }

  instance_configuration {
    instance_role_arn = aws_iam_role.chatbot_instance.arn
    cpu               = var.cpu
    memory            = var.memory
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.chatbot.arn

  tags = var.tags
}

# ── Auto-scaling ──────────────────────────────────────────────
resource "aws_apprunner_auto_scaling_configuration_version" "chatbot" {
  auto_scaling_configuration_name = "${var.service_name}-asc"
  max_concurrency                  = 100
  max_size                         = var.max_instances
  min_size                         = var.min_instances
  tags                             = var.tags
}

# ── CloudWatch Log Group ──────────────────────────────────────
resource "aws_cloudwatch_log_group" "chatbot" {
  name              = "/aws/apprunner/${var.service_name}"
  retention_in_days = 30
  tags              = var.tags
}
