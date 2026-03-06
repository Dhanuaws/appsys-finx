# =============================================================================
# IAM ROLES & POLICIES
# =============================================================================

# --- Shared assume role policy for Lambda ---
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}


# =============================================================================
# ROLE 1: email-attachment-parser
# =============================================================================

resource "aws_iam_role" "email_attachment_parser" {
  name                 = "email-attachment-parser-role-h9ukc1hg"
  path                 = "/service-role/"
  assume_role_policy   = data.aws_iam_policy_document.lambda_assume_role.json
  max_session_duration = 3600
}

# Managed policy attachments
resource "aws_iam_role_policy_attachment" "email_parser_basic_execution" {
  role       = aws_iam_role.email_attachment_parser.name
  policy_arn = "arn:aws:iam::${var.aws_account_id}:policy/service-role/AWSLambdaBasicExecutionRole-47ff6b3c-3c18-4eed-a4aa-2a95aa3abfe0"
}

resource "aws_iam_role_policy_attachment" "email_parser_sqs_execution" {
  role       = aws_iam_role.email_attachment_parser.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole"
}

resource "aws_iam_role_policy_attachment" "email_parser_sqs_full_access" {
  role       = aws_iam_role.email_attachment_parser.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
}

# Inline policy: DynamoDB read access to FusionInvoicesTable
resource "aws_iam_role_policy" "email_parser_fusiontable" {
  name = "email-parser-get-fusiontable-policy"
  role = aws_iam_role.email_attachment_parser.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowReadFusionTable"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/FusionInvoicesTable"
      }
    ]
  })
}

# Inline policy: SQS send to audit queue
resource "aws_iam_role_policy" "email_parser_audit_sqs_send" {
  name = "EmailParser-AuditSQSSend"
  role = aws_iam_role.email_attachment_parser.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowAuditSQSSend"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl"
        ]
        Resource = "arn:aws:sqs:${var.aws_region}:${var.aws_account_id}:appsys-invi-invoice-audit-events-queue"
      }
    ]
  })
}

# Inline policy: Bedrock Nova Lite model invocation
resource "aws_iam_role_policy" "email_parser_nova_lite" {
  name = "emailparser-nova-lite-policy"
  role = aws_iam_role.email_attachment_parser.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowBedrockNovaLite"
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.nova-lite-v1:0"
      }
    ]
  })
}

# Inline policy: DynamoDB write access to RawEmailMetaData table
resource "aws_iam_role_policy" "email_parser_raw_email_metadata" {
  name = "RawEmailMetaDataWriteAccess"
  role = aws_iam_role.email_attachment_parser.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/RawEmailMetaData",
          "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/RawEmailMetaData/index/FileHash-index"
        ]
      }
    ]
  })
}

# Inline policy: S3 read/write for email parsing
resource "aws_iam_role_policy" "email_parser_s3" {
  name = "S3ReadWriteEmailParserPolicy"
  role = aws_iam_role.email_attachment_parser.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowBucketListing"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = "arn:aws:s3:::amzn-s3-nova-bucket"
      },
      {
        Sid    = "AllowReadWriteInFolders"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "arn:aws:s3:::amzn-s3-nova-bucket/raw-emails/*",
          "arn:aws:s3:::amzn-s3-nova-bucket/email-attachment/*"
        ]
      }
    ]
  })
}


# =============================================================================
# ROLE 2: Nova-Extractor-Lambda
# =============================================================================

resource "aws_iam_role" "nova_extractor_lambda" {
  name                 = "Nova-Extractor-Lambda-role-2r21k3xp"
  path                 = "/service-role/"
  assume_role_policy   = data.aws_iam_policy_document.lambda_assume_role.json
  max_session_duration = 3600
}

# Managed policy attachments
resource "aws_iam_role_policy_attachment" "nova_extractor_basic_execution" {
  role       = aws_iam_role.nova_extractor_lambda.name
  policy_arn = "arn:aws:iam::${var.aws_account_id}:policy/service-role/AWSLambdaBasicExecutionRole-3ef283d8-60db-4044-90fe-b3c41d5c2ffb"
}

resource "aws_iam_role_policy_attachment" "nova_extractor_sqs_execution" {
  role       = aws_iam_role.nova_extractor_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole"
}

resource "aws_iam_role_policy_attachment" "nova_extractor_sqs_full_access" {
  role       = aws_iam_role.nova_extractor_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
}

# Inline policy: SQS send to audit queue (appsys)
resource "aws_iam_role_policy" "nova_extractor_audit_sqs_send" {
  name = "AppSys-InVi-Audit-SQS-Send"
  role = aws_iam_role.nova_extractor_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowSendAuditToSQS"
        Effect   = "Allow"
        Action   = "sqs:SendMessage"
        Resource = "arn:aws:sqs:${var.aws_region}:${var.aws_account_id}:appsys-invi-invoice-audit-events-queue"
      }
    ]
  })
}

# Inline policy: SQS send to audit queue (appsyn)
resource "aws_iam_role_policy" "nova_extractor_email_parser_audit_sqs" {
  name = "EmailParser-AuditSQSSend"
  role = aws_iam_role.nova_extractor_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowAuditSQSSend"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl"
        ]
        Resource = "arn:aws:sqs:${var.aws_region}:${var.aws_account_id}:appsyn-invi-invoice-audit-events-queue"
      }
    ]
  })
}

# Inline policy: S3 read + DynamoDB write + Bedrock invoke
resource "aws_iam_role_policy" "nova_extractor_dynamo" {
  name = "Extract-Nova-Dynamo"
  role = aws_iam_role.nova_extractor_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "arn:aws:s3:::email-attachment/*"
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem"]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/FusionInvoicesTable"
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
      }
    ]
  })
}

# Inline policy: S3 + Bedrock access for Nova extraction
resource "aws_iam_role_policy" "nova_extractor_s3" {
  name = "Nova-Extract-S3Policy"
  role = aws_iam_role.nova_extractor_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "arn:aws:s3:::amzn-s3-nova-bucket/email-attachment/*",
          "arn:aws:s3:::amzn-s3-nova-bucket/Nova-Extract-Json/*"
        ]
      },
      {
        Sid    = "BedrockAccess"
        Effect = "Allow"
        Action = ["bedrock:InvokeModel"]
        Resource = [
          "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.nova-pro-v1:0",
          "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.nova-lite-v1:0"
        ]
      }
    ]
  })
}

# Inline policy: DynamoDB full access to FusionInvoicesTable
resource "aws_iam_role_policy" "nova_extractor_dynamodb" {
  name = "Nova-Extractor-Lambda-DynamoDB-Policy"
  role = aws_iam_role.nova_extractor_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowFusionInvoicesTableAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:DescribeTable"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/FusionInvoicesTable",
          "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/FusionInvoicesTable/index/*"
        ]
      }
    ]
  })
}


# =============================================================================
# ROLE 3: invoice-audit-writer-lamdba
# =============================================================================

resource "aws_iam_role" "invoice_audit_writer" {
  name                 = "invoice-audit-writer-lamdba-role-lh1bhh2c"
  path                 = "/service-role/"
  assume_role_policy   = data.aws_iam_policy_document.lambda_assume_role.json
  max_session_duration = 3600
}

# Managed policy attachments
resource "aws_iam_role_policy_attachment" "audit_writer_basic_execution" {
  role       = aws_iam_role.invoice_audit_writer.name
  policy_arn = "arn:aws:iam::${var.aws_account_id}:policy/service-role/AWSLambdaBasicExecutionRole-dcfd4286-0b3c-42af-874f-ca061af37a55"
}

resource "aws_iam_role_policy_attachment" "audit_writer_sqs_execution" {
  role       = aws_iam_role.invoice_audit_writer.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole"
}

# Inline policy: DynamoDB access to InvoiceAuditLayer table
resource "aws_iam_role_policy" "audit_writer_dynamodb" {
  name = "InvoiceAuditLayerDynamoDBAccess"
  role = aws_iam_role.invoice_audit_writer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowInvoiceAuditLayerWrite"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DescribeTable"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/InvoiceAuditLayer"
      }
    ]
  })
}


# =============================================================================
# LAMBDA FUNCTIONS
# =============================================================================

# --- 1. email-attachment-parser ---
resource "aws_lambda_function" "email_attachment_parser" {
  function_name = "email-attachment-parser"
  role          = aws_iam_role.email_attachment_parser.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.13"
  timeout       = 30
  memory_size   = 128
  architectures = ["x86_64"]
  package_type  = "Zip"

  # NOTE: Replace with your actual deployment package path
  filename         = "src/email-attachment-parser.zip"
  source_code_hash = filebase64sha256("src/email-attachment-parser.zip")

  environment {
    variables = {
      AUDIT_SQS_URL     = "https://sqs.${var.aws_region}.amazonaws.com/${var.aws_account_id}/appsys-invi-invoice-audit-events-queue"
      WORKATO_API_TOKEN = "b2d760d4921475d6cfbda319fc70012b77d4bf7b965731adf2d4d7f7b014fe92"
      ENABLE_AUDIT_SQS  = "true"
    }
  }

  ephemeral_storage {
    size = 512
  }

  tracing_config {
    mode = "PassThrough"
  }

  logging_config {
    log_format = "Text"
    log_group  = "/aws/lambda/email-attachment-parser"
  }

  tags = {
    Environment = "appsys-invi-dev"
    Project     = "AppSys-inVi"
  }
}

# --- 2. Nova-Extractor-Lambda ---
resource "aws_lambda_function" "nova_extractor_lambda" {
  function_name = "Nova-Extractor-Lambda"
  role          = aws_iam_role.nova_extractor_lambda.arn
  handler       = "lambda_nova_extractor_trigger.lambda_handler"
  runtime       = "python3.13"
  timeout       = 45
  memory_size   = 128
  architectures = ["x86_64"]
  package_type  = "Zip"

  # NOTE: Replace with your actual deployment package path
  filename         = "src/Nova-Extractor-Lambda.zip"
  source_code_hash = filebase64sha256("src/Nova-Extractor-Lambda.zip")

  environment {
    variables = {
      AUDIT_SQS_URL = "https://sqs.${var.aws_region}.amazonaws.com/${var.aws_account_id}/appsyn-invi-invoice-audit-events-queue"
    }
  }

  ephemeral_storage {
    size = 512
  }

  tracing_config {
    mode = "PassThrough"
  }

  logging_config {
    log_format = "Text"
    log_group  = "/aws/lambda/Nova-Extractor-Lambda"
  }

  tags = {
    Environment = "appsys-invi-dev"
    Project     = "AppSys-inVi"
  }
}

# --- 3. invoice-audit-writer-lamdba ---
resource "aws_lambda_function" "invoice_audit_writer" {
  function_name = "invoice-audit-writer-lamdba"
  role          = aws_iam_role.invoice_audit_writer.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.13"
  timeout       = 3
  memory_size   = 128
  architectures = ["x86_64"]
  package_type  = "Zip"

  # NOTE: Replace with your actual deployment package path
  filename         = "src/invoice-audit-writer-lamdba.zip"
  source_code_hash = filebase64sha256("src/invoice-audit-writer-lamdba.zip")

  environment {
    variables = {
      DYNAMODB_TABLE = "InvoiceAuditLayer"
      ENABLE_DEDUP   = "true"
    }
  }

  ephemeral_storage {
    size = 512
  }

  tracing_config {
    mode = "PassThrough"
  }

  logging_config {
    log_format = "Text"
    log_group  = "/aws/lambda/invoice-audit-writer-lamdba"
  }

  tags = {
    Environment = "appsys-invi-dev"
    Project     = "AppSys-inVi"
    Component   = "DuplicateAuditWriter"
    Purpose     = "DuplicateInvoiceAudit"
  }
}


# =============================================================================
# CLOUDWATCH LOG GROUPS
# =============================================================================

resource "aws_cloudwatch_log_group" "email_attachment_parser" {
  name              = "/aws/lambda/email-attachment-parser"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "nova_extractor_lambda" {
  name              = "/aws/lambda/Nova-Extractor-Lambda"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "invoice_audit_writer" {
  name              = "/aws/lambda/invoice-audit-writer-lamdba"
  retention_in_days = 14
}


# =============================================================================
# EVENT SOURCE MAPPINGS (SQS TRIGGERS)
# =============================================================================

# invoice-audit-writer-lamdba is triggered by SQS queue
resource "aws_lambda_event_source_mapping" "invoice_audit_writer_sqs" {
  event_source_arn = "arn:aws:sqs:${var.aws_region}:${var.aws_account_id}:appsys-invi-invoice-audit-events-queue"
  function_name    = aws_lambda_function.invoice_audit_writer.arn
  batch_size       = 10
  enabled          = true
}


# =============================================================================
# LAMBDA PERMISSIONS (Resource-Based Policies)
# =============================================================================

# S3 bucket can invoke email-attachment-parser
resource "aws_lambda_permission" "email_parser_s3_invoke" {
  statement_id   = "lambda-ebe443df-21fb-41ae-bd2c-181a4abd23b7"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.email_attachment_parser.function_name
  principal      = "s3.amazonaws.com"
  source_account = var.aws_account_id
  source_arn     = "arn:aws:s3:::amzn-s3-nova-bucket"
}

# S3 bucket can invoke Nova-Extractor-Lambda
resource "aws_lambda_permission" "nova_extractor_s3_invoke" {
  statement_id   = "lambda-aa9e3054-68db-4b15-bffa-6e759e6da4ec"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.nova_extractor_lambda.function_name
  principal      = "s3.amazonaws.com"
  source_account = var.aws_account_id
  source_arn     = "arn:aws:s3:::amzn-s3-nova-bucket"
}
