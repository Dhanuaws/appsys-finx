# ── FinX Chatbot UI — AWS App Runner Module ──────────────────
# Deploys the Next.js frontend container to App Runner.
# Pulls image from ECR. IAM role grants CloudWatch Logs access.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
  ecr_url    = "${local.account_id}.dkr.ecr.${local.region}.amazonaws.com/${var.ecr_repository_name}"
}

# ── ECR Repository ────────────────────────────────────────────
resource "aws_ecr_repository" "frontend" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_ecr_lifecycle_policy" "frontend" {
  repository = aws_ecr_repository.frontend.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep only last 3 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 3
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

resource "aws_iam_role" "frontend_instance" {
  name               = "${var.service_name}-instance-role"
  assume_role_policy = data.aws_iam_policy_document.assume_apprunner.json
  tags               = var.tags
}

data "aws_iam_policy_document" "frontend_instance_policy" {
  # CloudWatch — write app logs
  statement {
    sid     = "CloudWatchLogs"
    actions = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/apprunner/${var.service_name}*"]
  }
}

resource "aws_iam_role_policy" "frontend_instance_policy" {
  name   = "${var.service_name}-instance-policy"
  role   = aws_iam_role.frontend_instance.id
  policy = data.aws_iam_policy_document.frontend_instance_policy.json
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

resource "aws_iam_role" "frontend_access" {
  name               = "${var.service_name}-access-role"
  assume_role_policy = data.aws_iam_policy_document.assume_apprunner_access.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "ecr_readonly_frontend" {
  role       = aws_iam_role.frontend_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# ── App Runner Service ────────────────────────────────────────
resource "aws_apprunner_service" "frontend" {
  service_name = var.service_name

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.frontend_access.arn
    }

    image_repository {
      image_identifier      = "${local.ecr_url}:${var.image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = "3000"

        runtime_environment_variables = {
          # Core AWS config
          AWS_REGION    = local.region
          ENVIRONMENT   = var.environment

          # App Backend Integration
          # BACKEND_URL needs to be the App Runner URL of Service A.
          BACKEND_URL   = var.backend_url

          # Cognito
          NEXT_PUBLIC_COGNITO_REGION        = local.region
          NEXT_PUBLIC_COGNITO_USER_POOL_ID  = var.cognito_user_pool_id
          NEXT_PUBLIC_COGNITO_APP_CLIENT_ID = var.cognito_app_client_id

          # Next-Auth
          NEXTAUTH_URL    = var.nextauth_url != "" ? var.nextauth_url : "https://placeholder-url.awsapprunner.com"
          NEXTAUTH_SECRET = var.nextauth_secret

          # Static vars
          APP_NAME = "FinX-Chatbot-UI"
        }
      }
    }

    auto_deployments_enabled = false
  }

  instance_configuration {
    instance_role_arn = aws_iam_role.frontend_instance.arn
    cpu               = var.cpu
    memory            = var.memory
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.frontend.arn

  tags = var.tags
}

# ── Auto-scaling ──────────────────────────────────────────────
resource "aws_apprunner_auto_scaling_configuration_version" "frontend" {
  auto_scaling_configuration_name = "${var.service_name}-asc"
  max_concurrency                  = 100
  max_size                         = var.max_instances
  min_size                         = var.min_instances
  tags                             = var.tags
}

# ── CloudWatch Log Group ──────────────────────────────────────
resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/aws/apprunner/${var.service_name}"
  retention_in_days = 30
  tags              = var.tags
}

# ── Outputs ───────────────────────────────────────────────────
output "service_url" {
  value = aws_apprunner_service.frontend.service_url
}

output "ecr_repository_url" {
  value = aws_ecr_repository.frontend.repository_url
}
