# =============================================================================
# WORKATO S3 INTEGRATION ROLE
# =============================================================================

# --- Trust Policy (Assume Role) ---
data "aws_iam_policy_document" "workato_trust_policy" {
  statement {
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.workato_aws_account_id}:root"]
    }

    actions = ["sts:AssumeRole"]

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [var.workato_external_id]
    }
  }
}

# --- IAM Role ---
resource "aws_iam_role" "workato_s3_role" {
  name                 = "Workato_S3_Integration_Role"
  description          = "Role Created for Workato"
  path                 = "/"
  max_session_duration = 3600

  assume_role_policy = data.aws_iam_policy_document.workato_trust_policy.json
}


# =============================================================================
# S3 READ ACCESS POLICY
# =============================================================================

# --- Managed Policy ---
resource "aws_iam_policy" "workato_s3_access" {
  name        = "WorkatoS3Access"
  path        = "/"
  description = "Allow Workato to read from amzn-s3-nova-bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          "arn:aws:s3:::amzn-s3-nova-bucket",
          "arn:aws:s3:::amzn-s3-nova-bucket/*"
        ]
      }
    ]
  })
}

# --- Attach Policy to Role ---
resource "aws_iam_role_policy_attachment" "workato_s3_attachment" {
  role       = aws_iam_role.workato_s3_role.name
  policy_arn = aws_iam_policy.workato_s3_access.arn
}
