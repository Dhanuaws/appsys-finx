resource "aws_s3_bucket" "nova_bucket" {
  bucket = "amzn-s3-nova-bucket"
}

resource "aws_s3_bucket_policy" "nova_bucket_policy" {
  bucket = aws_s3_bucket.nova_bucket.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSESPuts"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.nova_bucket.arn}/*"
        Condition = {
          StringEquals = {
            "aws:Referer" = "303289350965"
          }
        }
      }
    ]
  })
}
