"""
FinX RBAC Middleware
Validates Cognito JWT and injects ActorContext into every request.
Hard rule: tenantId is ALWAYS derived from the token, never from user input.
"""
from __future__ import annotations
import logging
from typing import Optional
from functools import lru_cache

import httpx
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError

from app.config import get_settings
from app.models import ActorContext

log = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)


# ── Cognito JWKS cache ─────────────────────────────────────────
@lru_cache(maxsize=1)
def _get_jwks(pool_id: str, region: str) -> dict:
    url = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json"
    resp = httpx.get(url, timeout=5.0)
    resp.raise_for_status()
    return resp.json()


def _decode_token(token: str) -> dict:
    settings = get_settings()

    # Dev mode: accept a simple base64 mock token
    if settings.dev_mode:
        return _dev_claims(token)

    jwks = _get_jwks(settings.cognito_user_pool_id, settings.cognito_region)
    try:
        claims = jwt.decode(
            token,
            jwks,
            algorithms=settings.jwt_algorithms,
            audience=settings.cognito_app_client_id,
            options={"verify_exp": True},
        )
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    return claims


def _dev_claims(token: str) -> dict:
    """
    In dev mode return a hardcoded admin actor so we can test locally
    without Cognito. NEVER reachable in production (dev_mode=False).
    """
    settings = get_settings()
    return {
        "sub": "dev-user-001",
        "email": "admin@appsys.dev",
        "name": "Dev Admin",
        "custom:tenantId": settings.dev_tenant_id,
        "custom:role": "ADMIN",
        "custom:canViewEmails": "true",
        "custom:piiAccess": "true",
        "custom:canApprovePayments": "true",
        "custom:maxApprovalLimit": "999999",
        "custom:entityIds": "",
        "custom:costCenters": "",
        "custom:vendorIds": "",
    }


def _build_actor(claims: dict) -> ActorContext:
    """Map Cognito custom claims → ActorContext."""
    def _list(val: Optional[str]) -> list[str]:
        if not val:
            return []
        return [v.strip() for v in val.split(",") if v.strip()]

    return ActorContext(
        user_id=claims["sub"],
        tenant_id=claims["custom:tenantId"],  # HARD RULE: from token only
        email=claims.get("email", ""),
        name=claims.get("name", ""),
        role=claims.get("custom:role", "AP_CLERK"),
        can_view_emails=claims.get("custom:canViewEmails", "false") == "true",
        pii_access=claims.get("custom:piiAccess", "false") == "true",
        can_approve_payments=claims.get("custom:canApprovePayments", "false") == "true",
        max_approval_limit=float(claims.get("custom:maxApprovalLimit", "0")),
        entity_ids=_list(claims.get("custom:entityIds")),
        cost_centers=_list(claims.get("custom:costCenters")),
        vendor_ids=_list(claims.get("custom:vendorIds")),
    )


async def get_actor(request: Request) -> ActorContext:
    """FastAPI dependency — validates JWT and returns actor context."""
    credentials: Optional[HTTPAuthorizationCredentials] = await security(request)

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    claims = _decode_token(credentials.credentials)
    actor = _build_actor(claims)

    # Attach actor to request state for logging middleware
    request.state.actor = actor

    return actor


def require_roles(*roles: str):
    """Dependency factory that restricts endpoint to specific roles."""
    async def _check(actor: ActorContext = ...) -> ActorContext:
        if actor.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{actor.role}' is not authorised for this action.",
            )
        return actor
    return _check


def require_email_access(actor: ActorContext) -> None:
    """Raise 403 if the actor cannot view email evidence."""
    if not actor.can_view_emails:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account does not have email evidence access.",
        )
