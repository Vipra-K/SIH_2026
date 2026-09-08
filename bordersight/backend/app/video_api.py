"""MVP video-ingestion routes for uploaded surveillance footage."""
from __future__ import annotations

import asyncio
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter(prefix="/api/video", tags=["video"])
UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED = {".mp4", ".webm", ".mov", ".avi", ".mkv"}
MAX_BYTES = 500 * 1024 * 1024

jobs: dict[str, dict] = {}


@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED:
        raise HTTPException(400, "Unsupported video format")
    job_id = uuid.uuid4().hex[:12]
    target = UPLOAD_DIR / f"{job_id}{suffix}"
    size = 0
    try:
        with target.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(413, "Video exceeds the 500 MB MVP limit")
                out.write(chunk)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    jobs[job_id] = {"id": job_id, "filename": file.filename, "status": "queued", "progress": 0, "path": str(target)}
    # The actual YOLO worker is imported lazily so the API health endpoint can
    # still start on machines where the optional AI runtime is not installed.
    from .video_processor import process_job
    asyncio.create_task(process_job(job_id))
    return {"job_id": job_id, "status": "queued", "filename": file.filename}


@router.get("/jobs/{job_id}")
async def job_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Video job not found")
    return {k: v for k, v in job.items() if k != "path"}


@router.get("/jobs")
async def list_jobs():
    return [{k: v for k, v in j.items() if k != "path"} for j in jobs.values()]
