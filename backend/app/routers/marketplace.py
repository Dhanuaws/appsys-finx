import logging
import uuid
import boto3
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status
from botocore.exceptions import ClientError

from app.config import get_settings

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
log = logging.getLogger(__name__)

class OnboardRequest(BaseModel):
    marketplace_token: str | None = None
    email: str
    company_name: str
    mock_mode: bool = False

@router.post("/onboard")
def onboard_tenant(req: OnboardRequest):
    settings = get_settings()
    
    customer_id = "mock-customer-id-1234"
    product_code = "mock-product-code"
    
    # 1. Resolve AWS Marketplace Token
    if not req.mock_mode:
        if not req.marketplace_token:
            raise HTTPException(status_code=400, detail="Marketplace token is required in production mode.")
            
        try:
            metering = boto3.client("meteringmarketplace", region_name=settings.aws_region)
            response = metering.resolve_customer(RegistrationToken=req.marketplace_token)
            customer_id = response.get("CustomerIdentifier")
            product_code = response.get("ProductCode")
            log.info("Marketplace Customer Resolved: %s", customer_id)
        except ClientError as e:
            log.error("Failed to resolve AWS Marketplace customer: %s", e)
            raise HTTPException(status_code=403, detail="Invalid AWS Marketplace Registration Token")

    # 2. Generate a secure Tenant Boundary
    tenant_uuid = f"tenant-{uuid.uuid4().hex[:12]}"
    log.info("Provisioning Workspace '%s' with TenantID: %s", req.company_name, tenant_uuid)

    # 3. Create the Cognito Administrator User
    if not settings.cognito_user_pool_id and not req.mock_mode:
        raise HTTPException(status_code=500, detail="Cognito User Pool ID is missing from configuration.")

    try:
        cognito = boto3.client("cognito-idp", region_name=settings.cognito_region)
        cognito.admin_create_user(
            UserPoolId=settings.cognito_user_pool_id,
            Username=req.email,
            UserAttributes=[
                {"Name": "email", "Value": req.email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "custom:tenantId", "Value": tenant_uuid},
                {"Name": "custom:role", "Value": "ADMIN"},
                {"Name": "custom:canViewEmails", "Value": "true"},
                {"Name": "custom:piiAccess", "Value": "true"},
                {"Name": "custom:canApprovePayments", "Value": "true"},
            ],
            DesiredDeliveryMediums=["EMAIL"],
            MessageAction="SUPPRESS" if req.mock_mode else "RESEND"
        )
        log.info("Successfully provisioned admin '%s' in Tenant '%s'", req.email, tenant_uuid)
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code == "UsernameExistsException":
            raise HTTPException(status_code=400, detail="User already exists in Cognito.")
        log.error("Cognito Provisioning Failed: %s", e)
        
        if req.mock_mode:
            log.warning("Bypassing Cognito error due to Mock Mode")
        else:
            raise HTTPException(status_code=500, detail="Failed to provision administrative account.")

    # In a full deployment, we would also create a Tenant Metadata record in DynamoDB here 
    # capturing customer_id, product_code, and company_name for future meter_usage billing.

    return {
        "status": "success",
        "tenant_id": tenant_uuid,
        "role": "ADMIN",
        "message": "Check your email for the temporary password."
    }
