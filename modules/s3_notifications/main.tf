resource "aws_lambda_permission" "allow_s3_invoke_raw" {
  statement_id   = "AllowExecutionFromS3RawEmails"
  action         = "lambda:InvokeFunction"
  function_name  = var.raw_emails_lambda_name
  principal      = "s3.amazonaws.com"
  source_arn     = "arn:aws:s3:::${var.bucket_name}"
  source_account = var.aws_account_id
}

resource "aws_lambda_permission" "allow_s3_invoke_attach" {
  statement_id   = "AllowExecutionFromS3EmailAttachment"
  action         = "lambda:InvokeFunction"
  function_name  = var.attachments_lambda_name
  principal      = "s3.amazonaws.com"
  source_arn     = "arn:aws:s3:::${var.bucket_name}"
  source_account = var.aws_account_id
}

resource "aws_s3_bucket_notification" "this" {
  bucket = var.bucket_name

  lambda_function {
    lambda_function_arn = var.raw_emails_lambda_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = var.raw_emails_prefix
  }

  lambda_function {
    lambda_function_arn = var.attachments_lambda_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = var.email_attachment_prefix
  }

  depends_on = [
    aws_lambda_permission.allow_s3_invoke_raw,
    aws_lambda_permission.allow_s3_invoke_attach
  ]
}
