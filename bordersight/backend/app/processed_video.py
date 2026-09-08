"""Browser-native annotated CCTV preview backed by the shared frame store."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from .frame_store import after
from .video_api import jobs

router = APIRouter(prefix="/api/video", tags=["video-preview"])


async def frames(job_id: str):
    """Yield newly processed JPEG frames until the video job finishes."""
    sequence = 0
    while True:
        current = jobs.get(job_id)
        if not current:
            return

        new_frames = after(job_id, sequence)
        if new_frames:
            for item in new_frames:
                sequence = item["sequence"]
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    + f"X-Frame-Sequence: {sequence}\r\n\r\n".encode()
                    + item["jpeg"]
                    + b"\r\n"
                )
            continue

        if current.get("status") in {"completed", "failed"}:
            return

        await asyncio.sleep(0.04)


@router.get("/jobs/{job_id}/mjpeg")
async def processed_mjpeg(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "Video job not found")
    return StreamingResponse(
        frames(job_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
