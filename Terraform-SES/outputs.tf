output "ses_domain_identity_arn" {
  description = "The ARN of the SES domain identity"
  value       = aws_ses_domain_identity.intake_domain.arn
}

output "ses_receipt_rule_set_name" {
  description = "The name of the SES receipt rule set"
  value       = aws_ses_receipt_rule_set.nova_intake_rules.rule_set_name
}

output "ses_configuration_set_name" {
  description = "The name of the SES configuration set"
  value       = aws_ses_configuration_set.appsys_project_t.name
}
