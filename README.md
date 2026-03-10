# FinX Invoice Intelligence — AI Chatbot

> **AWS Nova Hackathon Project** | Powered by [Amazon Nova Lite](https://aws.amazon.com/ai/generative-ai/nova/)

FinX is an enterprise-grade **Invoice Intelligence Copilot** for accounts payable teams. It uses Amazon Nova Lite (via Bedrock) for explainable, evidence-first AI that can search invoices, detect fraud, retrieve email evidence, and manage investigation cases.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js 15 · TypeScript · Tailwind CSS v4)        │
│  3-pane layout: Filter Pane | Chat | Evidence Panel         │
└────────────────────────┬────────────────────────────────────┘
                         │ SSE (POST /api/chat/stream)
                         │ (Next.js Edge proxy → adds JWT)
┌────────────────────────▼────────────────────────────────────┐
│  AWS App Runner — FastAPI (Python 3.12)                     │
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │ RBAC Mdlwr  │  │ Nova Lite Orch │  │ DynamoDB / S3    │ │
│  │ (Cognito    │  │ (6 tools, SSE) │  │ Email Evidence   │ │
│  │  JWT RS256) │  │                │  │ Signed URLs      │ │
│  └─────────────┘  └────────────────┘  └──────────────────┘ │
└────────────────────────────────────────────────────────────-┘
         │                  │                    │
    Cognito JWT      Bedrock Nova Lite      DynamoDB Tables
    validation       (amazon.nova-         FusionInvoicesTable
                     lite-v1:0)            RawEmailMetaData
                                           FinXEmailIndex
                                           FinXFraudCases
                                     S3: amzn-s3-nova-bucket
```

---

## Quick Start

### Local Development (with Docker Compose)
```bash
# 1. Configure AWS credentials
aws configure  # or use IAM role / env vars

# 2. Copy backend env
cp backend/.env.example backend/.env

# 3. Start everything
docker compose up -d

# Frontend: http://localhost:3000
# Backend:  http://localhost:8000/docs (FastAPI Swagger)
```

### Frontend only (no backend)
```bash
cd frontend
npm install
npm run dev
# http://localhost:3000 (backend calls will show friendly error)
```

### Backend only
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # set DEV_MODE=true
uvicorn app.main:app --reload --port 8000
```

---

## Project Structure

```
appsys-invi-iac-dev/
├── frontend/                   # Next.js 15 (TypeScript, Tailwind v4, Framer Motion)
│   ├── src/app/
│   │   ├── dashboard/          # 3-pane Intelligence Cockpit
│   │   ├── fraud-station/      # Fraud case management
│   │   └── api/chat/stream/    # Edge SSE proxy (adds JWT to backend calls)
│   └── src/components/
│       ├── chat/               # ChatPane, ChatBubble, citations
│       ├── filters/            # FilterPane (date, status, vendor, fraud score)
│       ├── evidence/           # EvidencePanel (email, attachments, RBAC)
│       └── layout/             # Navbar
│
├── backend/                    # Python FastAPI (AWS App Runner)
│   └── app/
│       ├── routers/            # /chat/stream, /invoices, /evidence, /fraud-cases
│       └── services/
│           ├── rbac.py         # Cognito JWT validation + ActorContext
│           ├── dynamodb.py     # SearchInvoices, GetInvoice, FraudCases
│           ├── s3.py           # Email evidence, MIME parser, signed URLs
│           └── bedrock.py      # Nova Lite orchestrator (6 tools, agentic loop)
│
├── .github/workflows/
│   ├── deploy.yml              # Terraform apply (main) / plan (PR)
│   ├── backend-deploy.yml      # ECR build + App Runner deploy
│   └── frontend-deploy.yml     # Next.js build + type check
│
├── docker-compose.yml          # Local dev: backend + frontend
│
└── appsys-invi-iac-modules/
    ├── chatbot_api/            # App Runner + ECR + IAM Terraform module
    ├── dynamodb/               # DynamoDB tables module
    ├── lambda_app/             # Existing Lambda functions
    └── sqs_queue/              # SQS + DLQ module
```

---

## Terraform: Enable Chatbot Features

```bash
cd appsys-invi-iac-dev

# Preview what will be created
terraform plan -var="enable_cognito=true" -var="enable_chatbot=true"

# Apply (provisions: Cognito User Pool, ECR repo, App Runner service)
terraform apply -var="enable_cognito=true" -var="enable_chatbot=true"

# Get outputs
terraform output chatbot_api_url     # → set as BACKEND_URL in frontend env
terraform output cognito_user_pool_id
terraform output ecr_repository_url  # → push Docker image here
```

---

## Deploy

### 1. Build & push the backend image
```bash
# Authenticate to ECR
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin $(terraform output -raw ecr_repository_url | cut -d/ -f1)

# Build and push
cd backend
docker build -t $(terraform -chdir=../appsys-invi-iac-dev output -raw ecr_repository_url):latest .
docker push $(terraform -chdir=../appsys-invi-iac-dev output -raw ecr_repository_url):latest
```

### 2. Trigger App Runner deployment
```bash
# Via AWS CLI
aws apprunner start-deployment \
  --service-arn $(aws apprunner list-services \
    --query "ServiceSummaryList[?ServiceName=='finx-chatbot-api'].ServiceArn" \
    --output text)

# Or push to main branch — GitHub Actions handles it automatically
```

---

## GitHub Actions Variables

Set these in **Settings → Environments → dev → Variables**:

| Variable | Value | Description |
|---|---|---|
| `ENABLE_COGNITO` | `true` | Enable Cognito in Terraform apply |
| `ENABLE_CHATBOT` | `true` | Enable App Runner in Terraform apply |
| `CHATBOT_IMAGE_TAG` | `latest` | Docker image tag to deploy |
| `BACKEND_URL` (secret) | `https://xxx.us-east-1.awsapprunner.com` | Backend URL for frontend build |

---

## Security

- **RBAC**: Cognito JWT RS256 validated on every request. `tenantId` always from token.
- **Tenant isolation**: All DynamoDB queries scoped to `actorContext.tenantId`.
- **Email access**: `canViewEmails=false` → body scrubbed, no signed URLs.
- **Signed URL scope**: S3 key must start with `{tenantId}/` prefix.
- **Prompt injection**: Emails land in the user turn only; system prompt is immutable.
- **Local dev**: `DEV_MODE=true` in `backend/.env` bypasses Cognito (never in prod).

---

## Nova Lite Tool Loop

Nova Lite orchestrates 6 tools via Bedrock `ConverseStream` API:

| Tool | Description |
|---|---|
| `SearchInvoices` | Filter invoices by status, vendor, date, fraud score, amount |
| `GetInvoice` | Full invoice detail by ID |
| `ListForgedInvoices` | Fraud list sorted by score |
| `GetEmailEvidence` | Email sender, body, attachments (RBAC gated) |
| `GetSignedUrl` | Pre-signed S3 URL for attachment download |
| `CreateFraudCase` | Open an investigation case (APPROVER/ADMIN only) |

Temperature: `0.1` | Max turns: `6` | Max tokens: `4096`
