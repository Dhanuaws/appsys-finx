# ==============================================================================
# Role: email-attachment-parser-role-h9ukc1hg
# ==============================================================================
resource "aws_iam_role" "email_parser_role" {
  name = "email-attachment-parser-role-h9ukc1hg"
  path = "/service-role/"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = {
    Project     = "AppSys-inVi"
    Environment = "appsys-invi-dev"
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "email_parser_basic_execution" {
  role       = aws_iam_role.email_parser_role.name
  policy_arn = "arn:aws:iam::303289350965:policy/service-role/AWSLambdaBasicExecutionRole-47ff6b3c-3c18-4eed-a4aa-2a95aa3abfe0"
}
resource "aws_iam_role_policy_attachment" "email_parser_sqs_execution" {
  role       = aws_iam_role.email_parser_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole"
}
resource "aws_iam_role_policy_attachment" "email_parser_sqs_full_access" {
  role       = aws_iam_role.email_parser_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
}

resource "aws_iam_role_policy" "email_parser_inline_policies" {
  name = "email_parser_inline_policies"
  role = aws_iam_role.email_parser_role.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowAuditSQSSend"
        Effect   = "Allow"
        Action   = ["sqs:SendMessage", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"]
        Resource = "arn:aws:sqs:us-east-1:303289350965:appsys-invi-invoice-audit-events-queue"
      },
      {
        Effect = "Allow"
        Action = ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:GetItem", "dynamodb:Query"]
        # Use dynamic arn for table we actually manage
        Resource = [
          aws_dynamodb_table.raw_email_metadata.arn,
          "${aws_dynamodb_table.raw_email_metadata.arn}/*"
        ]
      },
      {
        Sid      = "AllowBucketListing"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.nova_bucket.arn
      },
      {
        Sid    = "AllowReadWriteInFolders"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject"]
        Resource = [
          "${aws_s3_bucket.nova_bucket.arn}/raw-emails/*",
          "${aws_s3_bucket.nova_bucket.arn}/email-attachment/*"
        ]
      },
      {
        Sid      = "AllowReadFusionTable"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:Query"]
        Resource = "arn:aws:dynamodb:us-east-1:303289350965:table/FusionInvoicesTable"
      },
      {
        Sid      = "AllowBedrockNovaLite"
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0"
      }
    ]
  })
}


# ==============================================================================
# Role: Nova-Extractor-Lambda-role-2r21k3xp
# ==============================================================================
resource "aws_iam_role" "nova_extractor_role" {
  name = "Nova-Extractor-Lambda-role-2r21k3xp"
  path = "/service-role/"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = {
    Project     = "AppSys-inVi"
    Environment = "appsys-invi-dev"
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "nova_extractor_basic_execution" {
  role       = aws_iam_role.nova_extractor_role.name
  policy_arn = "arn:aws:iam::303289350965:policy/service-role/AWSLambdaBasicExecutionRole-3ef283d8-60db-4044-90fe-b3c41d5c2ffb"
}
resource "aws_iam_role_policy_attachment" "nova_extractor_sqs_execution" {
  role       = aws_iam_role.nova_extractor_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole"
}
resource "aws_iam_role_policy_attachment" "nova_extractor_sqs_full_access" {
  role       = aws_iam_role.nova_extractor_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
}

resource "aws_iam_role_policy" "nova_extractor_inline_policies" {
  name = "nova_extractor_inline_policies"
  role = aws_iam_role.nova_extractor_role.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowAuditSQSSend"
        Effect   = "Allow"
        Action   = ["sqs:SendMessage", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"]
        Resource = "arn:aws:sqs:us-east-1:303289350965:appsys-invi-invoice-audit-events-queue"
      },
      {
        Sid    = "AllowFusionInvoicesTableAccess"
        Effect = "Allow"
        Action = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:DescribeTable"]
        Resource = [
          "arn:aws:dynamodb:us-east-1:303289350965:table/FusionInvoicesTable",
          "arn:aws:dynamodb:us-east-1:303289350965:table/FusionInvoicesTable/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = ["s3:GetObject"]
        # Use dynamic ARN
        Resource = "${aws_s3_bucket.nova_bucket.arn}/email-attachment/*"
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
        Resource = "*"
      },
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject"]
        Resource = [
          "${aws_s3_bucket.nova_bucket.arn}/email-attachment/*",
          "${aws_s3_bucket.nova_bucket.arn}/Nova-Extract-Json/*"
        ]
      },
      {
        Sid    = "BedrockAccess"
        Effect = "Allow"
        Action = ["bedrock:InvokeModel"]
        Resource = [
          "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0",
          "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0"
        ]
      }
    ]
  })
}


# ==============================================================================
# Role: invoice-audit-writer-lamdba-role-lh1bhh2c
# ==============================================================================
resource "aws_iam_role" "invoice_audit_role" {
  name = "invoice-audit-writer-lamdba-role-lh1bhh2c"
  path = "/service-role/"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = {
    Project     = "AppSys-inVi"
    Environment = "appsys-invi-dev"
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "invoice_audit_basic_execution" {
  role       = aws_iam_role.invoice_audit_role.name
  policy_arn = "arn:aws:iam::303289350965:policy/service-role/AWSLambdaBasicExecutionRole-dcfd4286-0b3c-42af-874f-ca061af37a55"
}
resource "aws_iam_role_policy_attachment" "invoice_audit_sqs_execution" {
  role       = aws_iam_role.invoice_audit_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole"
}

resource "aws_iam_role_policy" "invoice_audit_inline_policies" {
  name = "invoice_audit_inline_policies"
  role = aws_iam_role.invoice_audit_role.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowInvoiceAuditLayerWrite"
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:DescribeTable"]
        Resource = "arn:aws:dynamodb:us-east-1:303289350965:table/InvoiceAuditLayer"
      }
    ]
  })
}
