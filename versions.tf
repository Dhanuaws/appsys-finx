terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # The variables below will be passed via backend config on `terraform init`
    # bucket         = "..."
    # key            = "dev/terraform.tfstate"
    # region         = "us-east-1"
    # dynamodb_table = "..."
    # encrypt        = true
  }
}
