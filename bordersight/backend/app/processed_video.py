"""Browser-native annotated CCTV preview.

The preview consumes cached frames produced by the upload processor instead of
running a second YOLO inference pass. The processor stores JPEG bytes in the
job's bounded frame buffer and updates the sequence number for each frame.
"""
from __future__ import annotations
import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from .video_api import jobs

router=APIRouter(prefix="/api/video",tags=["video-preview"])

async def frames(job_id:str):
    job=jobs.get(job_id)
    if not job:
        return
    sequence=0
    while True:
        current=jobs.get(job_id)
        if not current:
            return
        buffer=current.get("frames", [])
        new_frames=[item for item in buffer if item.get("sequence",0)>sequence]
        if new_frames:
            for item in new_frames:
                sequence=item["sequence"]
                yield b"--frame\r\nContent-Type: image/jpeg\r\nX-Frame-Sequence: %d\r\n\r\n"%sequence+item["jpeg"]+b"\r\n"
            continue
        if current.get("status") in {"completed","failed"}:
            return
        await asyncio.sleep(.04)

@router.get("/jobs/{job_id}/mjpeg")
async def processed_mjpeg(job_id:str):
    if job_id not in jobs:
        raise HTTPException(404,"Video job not found")
    return StreamingResponse(frames(job_id),media_type="multipart/x-mixed-replace; boundary=frame")
