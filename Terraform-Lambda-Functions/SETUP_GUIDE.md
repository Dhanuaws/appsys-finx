# Terraformer Setup Guide — Import Existing Lambda from AWS

## Step 1: Install AWS CLI

Download and install from:
👉 https://awscli.amazonaws.com/AWSCLIV2.msi

After installation, **restart your terminal** and verify:
```powershell
aws --version
```

Then configure your credentials:
```powershell
aws configure
```
You'll be prompted for:
- **AWS Access Key ID**
- **AWS Secret Access Key**
- **Default region** (e.g., `ap-south-1`)
- **Output format** (enter `json`)

---

## Step 2: Install Terraform

Download the Windows AMD64 binary from:
👉 https://developer.hashicorp.com/terraform/install

1. Extract the `terraform.exe` from the ZIP
2. Move it to a folder like `C:\terraform\`
3. Add `C:\terraform\` to your **System PATH**:
   - Search **"Environment Variables"** in Windows
   - Edit `Path` → Add `C:\terraform\`
4. Restart your terminal and verify:
```powershell
terraform --version
```

---

## Step 3: Install Terraformer

Download the latest Windows release from:
👉 https://github.com/GoogleCloudPlatform/terraformer/releases

1. Download `terraformer-aws-windows-amd64.exe`
2. Rename it to `terraformer.exe`
3. Move it to `C:\terraform\` (same folder as Terraform, already in PATH)
4. Restart your terminal and verify:
```powershell
terraformer --version
```

---

## Step 4: Initialize Terraform Provider

Run this in your project folder:
```powershell
cd "c:\Users\lenov\OneDrive - Appsys Global Pvt Ltd\Desktop\AI Agent\Terraforms\Email-Parser-Lambda"
terraform init
```
(The `versions.tf` file has already been created for you)

---

## Step 5: Import Your Lambda with Terraformer

### Import ALL Lambda functions in your region:
```powershell
terraformer import aws --resources=lambda --regions=ap-south-1
```

### Import a SPECIFIC Lambda by name:
```powershell
terraformer import aws --resources=lambda --filter="lambda_function=YOUR_FUNCTION_NAME" --regions=ap-south-1
```

### Import Lambda + related resources (IAM, CloudWatch, SES, S3):
```powershell
terraformer import aws --resources=lambda,iam,cloudwatch,ses,s3 --regions=ap-south-1
```

---

## Step 6: Check Output

Terraformer generates files under a `generated/` folder:
```
generated/
└── aws/
    └── lambda/
        ├── lambda_function.tf
        ├── outputs.tf
        ├── provider.tf
        └── terraform.tfstate
```

You can then copy these files into your project and customize them.

---

## ⚠️ Important Notes

- Replace `ap-south-1` with **your actual AWS region**
- Replace `YOUR_FUNCTION_NAME` with **your actual Lambda function name**
- Make sure your AWS credentials have **read access** to the Lambda and related services
- After import, review the generated `.tf` files and clean up any hardcoded values
