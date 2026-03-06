# =============================================================================
# WORKATO DYNAMODB ROLE
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
resource "aws_iam_role" "workato_dynamodb_role" {
  name                 = "WorkatoDynamoDBRole"
  description          = ""
  path                 = "/"
  max_session_duration = 3600

  assume_role_policy = data.aws_iam_policy_document.workato_trust_policy.json
}


# =============================================================================
# DYNAMODB ACCESS POLICY
# =============================================================================

# --- Managed Policy ---
resource "aws_iam_policy" "workato_dynamodb_access" {
  name        = "WorkatoDynamoDBAccessPolicy"
  path        = "/"
  description = "Allow Workato to read/write from FusionInvoicesTable"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "dynamodb:ListTables"
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/FusionInvoicesTable"
      }
    ]
  })
}

# --- Attach Policy to Role ---
resource "aws_iam_role_policy_attachment" "workato_dynamodb_attachment" {
  role       = aws_iam_role.workato_dynamodb_role.name
  policy_arn = aws_iam_policy.workato_dynamodb_access.arn
}
