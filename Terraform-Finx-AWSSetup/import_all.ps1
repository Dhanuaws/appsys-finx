$ErrorActionPreference = "Continue"

Write-Host "Importing S3 Resources..."
terraform import aws_s3_bucket.nova_bucket amzn-s3-nova-bucket
terraform import aws_s3_bucket_policy.nova_bucket_policy amzn-s3-nova-bucket

Write-Host "`nImporting DynamoDB Resources..."
terraform import aws_dynamodb_table.raw_email_metadata RawEmailMetaData

Write-Host "`nImporting Email Parser IAM Role..."
terraform import aws_iam_role.email_parser_role email-attachment-parser-role-h9ukc1hg
terraform import aws_iam_role_policy_attachment.email_parser_basic_execution email-attachment-parser-role-h9ukc1hg/arn:aws:iam::303289350965:policy/service-role/AWSLambdaBasicExecutionRole-47ff6b3c-3c18-4eed-a4aa-2a95aa3abfe0
terraform import aws_iam_role_policy_attachment.email_parser_sqs_execution email-attachment-parser-role-h9ukc1hg/arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole
terraform import aws_iam_role_policy_attachment.email_parser_sqs_full_access email-attachment-parser-role-h9ukc1hg/arn:aws:iam::aws:policy/AmazonSQSFullAccess
terraform import aws_iam_role_policy.email_parser_inline_policies email-attachment-parser-role-h9ukc1hg:email_parser_inline_policies

Write-Host "`nImporting Nova Extractor IAM Role..."
terraform import aws_iam_role.nova_extractor_role Nova-Extractor-Lambda-role-2r21k3xp
terraform import aws_iam_role_policy_attachment.nova_extractor_basic_execution Nova-Extractor-Lambda-role-2r21k3xp/arn:aws:iam::303289350965:policy/service-role/AWSLambdaBasicExecutionRole-3ef283d8-60db-4044-90fe-b3c41d5c2ffb
terraform import aws_iam_role_policy_attachment.nova_extractor_sqs_execution Nova-Extractor-Lambda-role-2r21k3xp/arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole
terraform import aws_iam_role_policy_attachment.nova_extractor_sqs_full_access Nova-Extractor-Lambda-role-2r21k3xp/arn:aws:iam::aws:policy/AmazonSQSFullAccess
terraform import aws_iam_role_policy.nova_extractor_inline_policies Nova-Extractor-Lambda-role-2r21k3xp:nova_extractor_inline_policies

Write-Host "`nImporting Invoice Audit IAM Role..."
terraform import aws_iam_role.invoice_audit_role invoice-audit-writer-lamdba-role-lh1bhh2c
terraform import aws_iam_role_policy_attachment.invoice_audit_basic_execution invoice-audit-writer-lamdba-role-lh1bhh2c/arn:aws:iam::303289350965:policy/service-role/AWSLambdaBasicExecutionRole-dcfd4286-0b3c-42af-874f-ca061af37a55
terraform import aws_iam_role_policy_attachment.invoice_audit_sqs_execution invoice-audit-writer-lamdba-role-lh1bhh2c/arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole
terraform import aws_iam_role_policy.invoice_audit_inline_policies invoice-audit-writer-lamdba-role-lh1bhh2c:invoice_audit_inline_policies

Write-Host "`nImporting Lambda Functions..."
terraform import aws_lambda_function.email_attachment_parser email-attachment-parser
terraform import aws_lambda_function.nova_extractor_lambda Nova-Extractor-Lambda
terraform import aws_lambda_function.invoice_audit_writer invoice-audit-writer-lamdba

Write-Host "`nImport complete! Running terraform plan to validate..."
terraform plan
