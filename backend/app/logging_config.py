"""
FinX Structured JSON Logging
────────────────────────────────────────────────────────────────
Emits log records as single-line JSON to CloudWatch.
Each record includes:
  - timestamp, level, logger, message
  - duration_ms  (for slow-request metric filter)
  - status_code  (for 5xx metric filter)
  - tenant_id    (for per-tenant debugging)
  - request_id   (for log correlation)

CloudWatch metric filter patterns require matching JSON keys:
  • { $.duration_ms > 5000 }      → SlowRequestCount metric
  • { $.levelname = "ERROR" && $.message = "*Bedrock*" } → BedrockErrorCount
"""
import json
import logging
import sys
import time
from typing import Any


class JsonFormatter(logging.Formatter):
    """Formats log records as a single-line JSON string."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S.%03dZ"),
            "levelname": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Include exception info when present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Pass-through extra fields (duration_ms, status_code, tenant_id, etc.)
        for key in ("duration_ms", "status_code", "tenant_id", "request_id", "tool", "model"):
            if hasattr(record, key):
                log_data[key] = getattr(record, key)

        return json.dumps(log_data, ensure_ascii=False)


def configure_structured_logging(level: str = "INFO") -> None:
    """Call this once at startup to switch the root logger to JSON format."""
    formatter = JsonFormatter()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Suppress noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
