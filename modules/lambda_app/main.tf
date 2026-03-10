data "aws_iam_policy_document" "assume_lambda" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "email_parser" {
  name_prefix        = "${var.fn_email_attachment_parser}-role-"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
  tags               = var.tags
}

resource "aws_iam_role" "nova_extractor" {
  name_prefix        = "${var.fn_nova_extractor}-role-"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
  tags               = var.tags
}

resource "aws_iam_role" "audit_writer" {
  name_prefix        = "${var.fn_audit_writer}-role-"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "basic_email" {
  role       = aws_iam_role.email_parser.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "basic_nova" {
  role       = aws_iam_role.nova_extractor.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "basic_audit" {
  role       = aws_iam_role.audit_writer.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "email_parser_inline" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::${var.bucket_name}/raw-emails/*"]
  }

  statement {
    actions   = ["s3:PutObject"]
    resources = ["arn:aws:s3:::${var.bucket_name}/email-attachment/*"]
  }

  statement {
    actions   = ["sqs:SendMessage"]
    resources = [var.audit_queue_arn]
  }
}

resource "aws_iam_role_policy" "email_parser_inline" {
  name   = "${var.fn_email_attachment_parser}-inline"
  role   = aws_iam_role.email_parser.id
  policy = data.aws_iam_policy_document.email_parser_inline.json
}

data "aws_iam_policy_document" "nova_extractor_inline" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::${var.bucket_name}/email-attachment/*"]
  }

  statement {
    actions   = ["sqs:SendMessage"]
    resources = [var.audit_queue_arn]
  }

  statement {
    actions   = ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:GetItem", "dynamodb:Query", "dynamodb:Scan"]
    resources = values(var.dynamodb_table_arns)
  }

  statement {
    actions   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
    resources = var.bedrock_model_arns
  }
}

resource "aws_iam_role_policy" "nova_extractor_inline" {
  name   = "${var.fn_nova_extractor}-inline"
  role   = aws_iam_role.nova_extractor.id
  policy = data.aws_iam_policy_document.nova_extractor_inline.json
}

data "aws_iam_policy_document" "audit_writer_inline" {
  statement {
    actions   = ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:GetItem"]
    resources = values(var.dynamodb_table_arns)
  }
}

resource "aws_iam_role_policy" "audit_writer_inline" {
  name   = "${var.fn_audit_writer}-inline"
  role   = aws_iam_role.audit_writer.id
  policy = data.aws_iam_policy_document.audit_writer_inline.json
}

resource "aws_cloudwatch_log_group" "lg_email" {
  name              = "/aws/lambda/${var.fn_email_attachment_parser}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "lg_nova" {
  name              = "/aws/lambda/${var.fn_nova_extractor}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "lg_audit" {
  name              = "/aws/lambda/${var.fn_audit_writer}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

locals {
  env_email = merge(
    {
      BUCKET_NAME   = var.bucket_name
      AUDIT_SQS_URL = var.audit_queue_url
    },
    var.extra_env_email_parser
  )

  env_nova = merge(
    {
      BUCKET_NAME   = var.bucket_name
      AUDIT_SQS_URL = var.audit_queue_url
    },
    var.extra_env_nova_extractor
  )

  env_audit = merge({}, var.extra_env_audit_writer)
}

resource "aws_lambda_function" "email_parser" {
  function_name    = var.fn_email_attachment_parser
  role             = aws_iam_role.email_parser.arn
  runtime          = var.runtime
  handler          = var.handler_email_attachment_parser
  filename         = var.zip_email_attachment_parser
  source_code_hash = filebase64sha256(var.zip_email_attachment_parser)

  memory_size = var.memory_size
  timeout     = var.timeout

  environment {
    variables = local.env_email
  }

  tags = var.tags

  depends_on = [aws_cloudwatch_log_group.lg_email]
}

resource "aws_lambda_function" "nova_extractor" {
  function_name    = var.fn_nova_extractor
  role             = aws_iam_role.nova_extractor.arn
  runtime          = var.runtime
  handler          = var.handler_nova_extractor
  filename         = var.zip_nova_extractor
  source_code_hash = filebase64sha256(var.zip_nova_extractor)

  memory_size = var.memory_size
  timeout     = var.timeout

  environment {
    variables = local.env_nova
  }

  tags = var.tags

  depends_on = [aws_cloudwatch_log_group.lg_nova]
}

resource "aws_lambda_function" "audit_writer" {
  function_name    = var.fn_audit_writer
  role             = aws_iam_role.audit_writer.arn
  runtime          = var.runtime
  handler          = var.handler_audit_writer
  filename         = var.zip_audit_writer
  source_code_hash = filebase64sha256(var.zip_audit_writer)

  memory_size = var.memory_size
  timeout     = var.timeout

  environment {
    variables = local.env_audit
  }

  tags = var.tags

  depends_on = [aws_cloudwatch_log_group.lg_audit]
}
