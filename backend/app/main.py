"""
FinX Backend — FastAPI Application Entry Point
"""
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.logging_config import configure_structured_logging
from app.routers import chat, invoices, evidence, fraud_cases, marketplace, users

# ── Structured JSON Logging (matches CloudWatch metric filter patterns) ──
configure_structured_logging()
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    log.info("FinX backend starting — env=%s model=%s", settings.environment, settings.bedrock_model_id)
    log.info("Dev mode: %s", settings.dev_mode)
    yield
    log.info("FinX backend shutting down")


# ── App factory ───────────────────────────────────────────────
def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="FinX Invoice Intelligence API",
        description=(
            "Evidence-first AI backend for invoice search, fraud detection, "
            "and email evidence retrieval. Powered by Amazon Nova Lite."
        ),
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "prod" else None,
        redoc_url=None,
    )

    # ── CORS ──────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

    # ── Request logging middleware (emits JSON for CW metric filters) ──
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 1)
        actor = getattr(request.state, "actor", None)
        tenant = actor.tenant_id if actor else "anonymous"
        # Emit fields that match CloudWatch metric filter patterns:
        #   { $.duration_ms > 5000 }       → SlowRequestCount
        #   { $.status_code >= 500 }        → (optional future alarm)
        log.info(
            "%s %s",
            request.method,
            request.url.path,
            extra={
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "tenant_id": tenant,
                "request_id": request.headers.get("X-Request-ID", ""),
            },
        )
        return response

    # ── Global exception handler ──────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        log.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "code": "INTERNAL_ERROR"},
        )

    # ── Routers ───────────────────────────────────────────────
    app.include_router(chat.router)
    app.include_router(invoices.router)
    app.include_router(evidence.router)
    app.include_router(fraud_cases.router)
    app.include_router(marketplace.router)
    app.include_router(users.router)

    # ── Health check ──────────────────────────────────────────
    @app.get("/health", tags=["ops"])
    def health():
        settings = get_settings()
        return {
            "status": "healthy",
            "app": settings.app_name,
            "environment": settings.environment,
            "model": settings.bedrock_model_id,
        }

    # ── API info ──────────────────────────────────────────────
    @app.get("/", tags=["ops"])
    def root():
        return {
            "name": "FinX Invoice Intelligence API",
            "version": "1.0.0",
            "powered_by": "Amazon Nova Lite (amazon.nova-lite-v1:0)",
        }

    return app


app = create_app()
