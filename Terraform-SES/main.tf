# =============================================================================
# AMAZON SES CONFIGURATION
# =============================================================================

# --- Domain Identity ---
# In a real environment, you must add the corresponding DNS records (TXT) 
# to your domain's DNS settings to verify the identity.
resource "aws_ses_domain_identity" "intake_domain" {
  domain = "intake.appsysglobal.com"
}

# --- Configuration Set ---
resource "aws_ses_configuration_set" "appsys_project_t" {
  name = "Appsys_Project_T"
}

# --- Receipt Rule Set ---
resource "aws_ses_receipt_rule_set" "nova_intake_rules" {
  rule_set_name = "nova-intake-rules"
}

# --- Activate the Rule Set ---
# Note: Only one receipt rule set can be active at a time in a region.
resource "aws_ses_active_receipt_rule_set" "active_rules" {
  rule_set_name = aws_ses_receipt_rule_set.nova_intake_rules.rule_set_name
}

# --- Receipt Rule ---
# This rule takes incoming emails and routes them to the S3 bucket.
resource "aws_ses_receipt_rule" "nova_intake_rule" {
  name          = "nova-intake-rules"
  rule_set_name = aws_ses_receipt_rule_set.nova_intake_rules.rule_set_name
  recipients    = ["project.tools@intake.appsysglobal.com"]
  enabled       = true
  scan_enabled  = true
  tls_policy    = "Optional"

  s3_action {
    bucket_name       = "amzn-s3-nova-bucket"
    object_key_prefix = "raw-emails/"
    position          = 1
  }
}
