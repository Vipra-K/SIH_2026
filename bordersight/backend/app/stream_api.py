"""Streaming API routes used by the BorderSight command center."""
from __future__ import annotations

import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from .realtime import hub

router = APIRouter(prefix="/api/stream", tags=["realtime"])


@router.get("/events")
async def event_stream() -> StreamingResponse:
    async def generate():
        yield "event: connected\ndata: {\"status\":\"connected\"}\n\n"
        async for message in hub.subscribe():
            yield f"event: border-event\ndata: {message}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/heartbeat")
async def heartbeat():
    await asyncio.sleep(0)
    return {"status": "stream-ready"}
