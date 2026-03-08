data "archive_file" "email_attachment_parser_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src/email-attachment-parser"
  output_path = "${path.module}/build/email-attachment-parser.zip"
}

resource "aws_lambda_function" "email_attachment_parser" {
  function_name = "email-attachment-parser"
  runtime       = "python3.12"
  handler       = "lambda_function.lambda_handler"
  role          = aws_iam_role.email_parser_role.arn
  timeout       = 30
  memory_size   = 128

  filename         = data.archive_file.email_attachment_parser_zip.output_path
  source_code_hash = data.archive_file.email_attachment_parser_zip.output_base64sha256

  environment {
    variables = {
      AUDIT_SQS_URL     = "https://sqs.us-east-1.amazonaws.com/303289350965/appsys-invi-invoice-audit-events-queue"
      WORKATO_API_TOKEN = "b2d760d4921475d6cfbda319fc70012b77d4bf7b965731adf2d4d7f7b014fe92"
      ENABLE_AUDIT_SQS  = "true"
    }
  }

  ephemeral_storage {
    size = 512
  }

  tags = {
    Project     = "AppSys-inVi"
    Environment = "appsys-invi-dev"
  }
}

data "archive_file" "nova_extractor_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src/Nova-Extractor-Lambda"
  output_path = "${path.module}/build/Nova-Extractor-Lambda.zip"
}

resource "aws_lambda_function" "nova_extractor_lambda" {
  function_name = "Nova-Extractor-Lambda"
  runtime       = "python3.12"
  handler       = "lambda_nova_extractor_trigger.lambda_handler"
  role          = aws_iam_role.nova_extractor_role.arn
  timeout       = 45
  memory_size   = 128

  filename         = data.archive_file.nova_extractor_lambda_zip.output_path
  source_code_hash = data.archive_file.nova_extractor_lambda_zip.output_base64sha256

  environment {
    variables = {
      AUDIT_SQS_URL = "https://sqs.us-east-1.amazonaws.com/303289350965/appsys-invi-invoice-audit-events-queue"
    }
  }

  ephemeral_storage {
    size = 512
  }

  tags = {
    Project     = "AppSys-inVi"
    Environment = "appsys-invi-dev"
  }
}


data "archive_file" "invoice_audit_writer_lamdba_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src/invoice-audit-writer-lamdba"
  output_path = "${path.module}/build/invoice-audit-writer-lamdba.zip"
}

resource "aws_lambda_function" "invoice_audit_writer" {
  function_name = "invoice-audit-writer-lamdba"
  runtime       = "python3.12"
  handler       = "lambda_function.lambda_handler"
  role          = aws_iam_role.invoice_audit_role.arn
  timeout       = 3
  memory_size   = 128

  filename         = data.archive_file.invoice_audit_writer_lamdba_zip.output_path
  source_code_hash = data.archive_file.invoice_audit_writer_lamdba_zip.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE = "InvoiceAuditLayer"
      ENABLE_DEDUP   = "true"
    }
  }

  ephemeral_storage {
    size = 512
  }

  tags = {
    Project     = "AppSys-inVi"
    Environment = "appsys-invi-dev"
    Purpose     = "DuplicateInvoiceAudit"
    Component   = "DuplicateAuditWriter"
  }
}
