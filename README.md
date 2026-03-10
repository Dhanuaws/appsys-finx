# AppSys inVi – Production-grade Terraform repo (Hackathon baseline)

This repo is **clean HCL** (no invalid single-line blocks), modular, and safe-by-default.

## What it deploys
SES (optional inbound) -> S3 (raw-emails/) -> Lambda(email-attachment-parser)
-> S3 (email-attachment/) -> Lambda(Nova-Extractor-Lambda)
-> SQS(appsys-invi-invoice-audit-events-queue) -> Lambda(invoice-audit-writer-lamdba)
+ DynamoDB tables.

## Safety (your existing account)
If these resources already exist in your AWS account, **do NOT run `terraform apply`**.
Use:
- `terraform fmt -recursive`
- `terraform init`
- `terraform validate`
- `terraform plan` (reads; no changes)

To manage existing infra, use `terraform import` (recommended).

## Lambda artifacts
Put your tested zips in `artifacts/`:
- email-attachment-parser.zip
- Nova-Extractor-Lambda.zip
- invoice-audit-writer-lamdba.zip

## DynamoDB tables (no manual typing)
If you have `exports-appsys-invi/dynamodb/*.describe.json`, generate:
```bash
python3 tools/ddb_from_describe.py --in exports-appsys-invi/dynamodb --out examples/hackathon-dev/ddb.auto.tfvars.json
```

## Examples
- `examples/hackathon-dev`: SES enabled (your demo account)
- `examples/judge-mode`: SES disabled, upload a sample `.eml` to trigger

