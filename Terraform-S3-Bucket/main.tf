# =============================================================================
# S3 BUCKET: amzn-s3-nova-bucket
# =============================================================================

resource "aws_s3_bucket" "nova_bucket" {
  bucket = "amzn-s3-nova-bucket"

  tags = {
    Project     = "AppSys-inVi"
    Bucket      = "S3 Bucket to Store Attachments from the Incoming mail"
    Environment = "appsys-invi-dev"
  }
}


# =============================================================================
# VERSIONING
# =============================================================================

resource "aws_s3_bucket_versioning" "nova_bucket" {
  bucket = aws_s3_bucket.nova_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}


# =============================================================================
# SERVER-SIDE ENCRYPTION
# =============================================================================

resource "aws_s3_bucket_server_side_encryption_configuration" "nova_bucket" {
  bucket = aws_s3_bucket.nova_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}


# =============================================================================
# PUBLIC ACCESS BLOCK
# =============================================================================

resource "aws_s3_bucket_public_access_block" "nova_bucket" {
  bucket = aws_s3_bucket.nova_bucket.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}


# =============================================================================
# BUCKET POLICY - Allow SES to put objects
# =============================================================================

resource "aws_s3_bucket_policy" "nova_bucket" {
  bucket = aws_s3_bucket.nova_bucket.id

  # Ensure public access block is applied first
  depends_on = [aws_s3_bucket_public_access_block.nova_bucket]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowSESPuts"
        Effect    = "Allow"
        Principal = { Service = "ses.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.nova_bucket.arn}/*"
        Condition = {
          StringEquals = {
            "aws:Referer" = var.aws_account_id
          }
        }
      }
    ]
  })
}


# =============================================================================
# BUCKET OWNERSHIP CONTROLS
# =============================================================================

resource "aws_s3_bucket_ownership_controls" "nova_bucket" {
  bucket = aws_s3_bucket.nova_bucket.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}


# =============================================================================
# S3 EVENT NOTIFICATIONS -> LAMBDA
# =============================================================================

resource "aws_s3_bucket_notification" "nova_bucket" {
  bucket = aws_s3_bucket.nova_bucket.id

  # Trigger email-attachment-parser on objects in raw-emails/
  lambda_function {
    lambda_function_arn = "arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:email-attachment-parser"
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "raw-emails/"
    id                  = "5eb0f473-3159-45d5-a8b4-a82755131e13"
  }

  # Trigger Nova-Extractor-Lambda on objects in email-attachment/
  lambda_function {
    lambda_function_arn = "arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:Nova-Extractor-Lambda"
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "email-attachment/"
    id                  = "13dd8b32-503a-41fb-848e-092146f40ac8"
  }

  # NOTE: The Lambda functions must have resource-based policies allowing
  # s3.amazonaws.com to invoke them. These permissions are already defined
  # in the Terraform-Lambda-Functions project (aws_lambda_permission resources).
}
