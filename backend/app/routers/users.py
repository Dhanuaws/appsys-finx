import logging
import boto3
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from botocore.exceptions import ClientError

from app.config import get_settings
from app.models import ActorContext
from app.services.rbac import require_roles

router = APIRouter(prefix="/users", tags=["users"])
log = logging.getLogger(__name__)

class InviteRequest(BaseModel):
    email: str
    role: str = "AP_CLERK"
    can_view_emails: bool = False
    pii_access: bool = False
    can_approve_payments: bool = False

@router.post("/invite")
def invite_user(
    req: InviteRequest,
    actor: ActorContext = Depends(require_roles("ADMIN"))
):
    settings = get_settings()
    
    log.info("Admin %s invoking team invite for %s in Tenant %s", actor.email, req.email, actor.tenant_id)

    if not settings.cognito_user_pool_id and not settings.dev_mode:
        raise HTTPException(status_code=500, detail="Cognito User Pool ID is missing from configuration.")

    try:
        cognito = boto3.client("cognito-idp", region_name=settings.cognito_region)
        cognito.admin_create_user(
            UserPoolId=settings.cognito_user_pool_id,
            Username=req.email,
            UserAttributes=[
                {"Name": "email", "Value": req.email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "custom:tenantId", "Value": actor.tenant_id},  # Hard isolate to the Admin's tenant!
                {"Name": "custom:role", "Value": req.role},
                {"Name": "custom:canViewEmails", "Value": "true" if req.can_view_emails else "false"},
                {"Name": "custom:piiAccess", "Value": "true" if req.pii_access else "false"},
                {"Name": "custom:canApprovePayments", "Value": "true" if req.can_approve_payments else "false"},
            ],
            DesiredDeliveryMediums=["EMAIL"]
        )
        log.info("Successfully provisioned %s '%s' in Tenant '%s'", req.role, req.email, actor.tenant_id)
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code == "UsernameExistsException":
            raise HTTPException(status_code=400, detail="User already exists in Cognito.")
        log.error("Cognito Provisioning Failed: %s", e)
        
        if settings.dev_mode:
            log.warning("Bypassing Cognito error due to Mock Mode")
        else:
            raise HTTPException(status_code=500, detail="Failed to invite team member.")

    return {
        "status": "success",
        "email": req.email,
        "role": req.role,
        "message": "Invite sent successfully."
    }
