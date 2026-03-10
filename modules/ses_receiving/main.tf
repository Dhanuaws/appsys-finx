resource "aws_ses_receipt_rule_set" "this" {
  rule_set_name = var.rule_set_name
}

resource "aws_ses_receipt_rule" "this" {
  name          = var.rule_name
  rule_set_name = aws_ses_receipt_rule_set.this.rule_set_name
  enabled       = true
  recipients    = var.recipients
  tls_policy    = var.tls_policy
  scan_enabled  = var.scan_enabled

  s3_action {
    position          = 1
    bucket_name       = var.bucket_name
    object_key_prefix = var.object_prefix
  }
}

resource "aws_ses_active_receipt_rule_set" "this" {
  rule_set_name = aws_ses_receipt_rule_set.this.rule_set_name
}
