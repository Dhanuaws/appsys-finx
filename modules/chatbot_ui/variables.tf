# ── chatbot_ui module variables ──────────────────────────────

variable "service_name" {
  description = "App Runner service name for the UI"
  type        = string
  default     = "finx-chatbot-ui"
}

variable "ecr_repository_name" {
  description = "ECR repository name for the frontend Docker image"
  type        = string
  default     = "finx-chatbot-ui"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "environment" {
  description = "Environment name (dev / staging / prod)"
  type        = string
  default     = "dev"
}

# ── Compute ───────────────────────────────────────────────────
variable "cpu" {
  description = "App Runner CPU (256 | 512 | 1024 | 2048 | 4096)"
  type        = string
  default     = "512"
}

variable "memory" {
  description = "App Runner memory in MB (512 | 1024 | 2048 | 3072 | 4096 | 6144 | 8192 | 10240 | 12288)"
  type        = string
  default     = "1024"
}

variable "min_instances" {
  description = "Minimum App Runner instances"
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum App Runner instances"
  type        = number
  default     = 3
}

# ── Application Config ───────────────────────────────────────
variable "backend_url" {
  description = "URL of the backend API service"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "cognito_app_client_id" {
  description = "Cognito App Client ID"
  type        = string
}

variable "nextauth_secret" {
  description = "Secret for Next-Auth (can be random string)"
  type        = string
  default     = "super-secret-default-change-me"
}

variable "nextauth_url" {
  description = "Full URL of the frontend (for Next-Auth redirects)"
  type        = string
  default     = ""
}

# ── Tags ──────────────────────────────────────────────────────
variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
