resource "random_id" "suffix" {
  byte_length = 3
}

locals {
  final_bucket_name = var.bucket_name != "" ? var.bucket_name : "${var.bucket_base_name}-${random_id.suffix.hex}"
}

resource "aws_s3_bucket" "this" {
  bucket        = local.final_bucket_name
  force_destroy = var.force_destroy
  tags          = var.tags
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  count  = var.enable_sse_s3 ? 1 : 0
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

data "aws_iam_policy_document" "ses_put" {
  count = var.allow_ses_put ? 1 : 0

  statement {
    sid     = "AllowSESPutObject"
    effect  = "Allow"
    actions = ["s3:PutObject"]

    resources = [
      "${aws_s3_bucket.this.arn}/${var.ses_object_prefix}*"
    ]

    principals {
      type        = "Service"
      identifiers = ["ses.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:Referer"
      values   = [var.aws_account_id]
    }
  }
}

resource "aws_s3_bucket_policy" "ses_put" {
  count  = var.allow_ses_put ? 1 : 0
  bucket = aws_s3_bucket.this.id
  policy = data.aws_iam_policy_document.ses_put[0].json
}
