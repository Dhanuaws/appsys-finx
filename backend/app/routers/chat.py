"""
Chat Router — POST /chat/stream (SSE)
The main AI orchestrator endpoint. Streams Nova Lite responses.
"""
import json
import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.models import ActorContext, ChatRequest
from app.services.rbac import get_actor
from app.services.bedrock import stream_chat

log = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    actor: ActorContext = Depends(get_actor),
):
    """
    Stream a chat response from Amazon Nova Lite.
    Returns Server-Sent Events (SSE) with text chunks and citations.
    """
    # Frontend manages stateless conversation history by passing it
    conversation_history = body.conversation_history or []

    async def event_generator():
        try:
            async for event in stream_chat(
                actor=actor,
                user_message=body.message,
                conversation_history=conversation_history,
                audit_mode=body.audit_mode,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            log.exception("Stream error: %s", e)
            yield f"data: {json.dumps({'type': 'chunk', 'text': 'Sorry, an error occurred.'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
