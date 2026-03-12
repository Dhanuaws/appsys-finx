import os
import boto3
from app.services.dynamodb import list_audit_logs
from app.models import ActorContext
from app.config import get_settings

# Mock ActorContext for dev tenant
actor = ActorContext(
    user_id="test-user",
    tenant_id="tenant-appsys-dev",
    email="test@appsys.io",
    name="Test User",
    role="ADMIN",
    can_view_emails=True,
    pii_access=True
)

def verify_audit():
    print(f"Checking audit logs for tenant: {actor.tenant_id}")
    logs = list_audit_logs(actor, limit=100)
    print(f"Found {len(logs)} audit records.")
    
    for log in logs:
        print(f"[{log.processed_at}] Event: {log.event_type} | Status: {log.status} | Reason: {log.reason}")

if __name__ == "__main__":
    verify_audit()
