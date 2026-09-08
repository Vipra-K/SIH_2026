"""MJPEG stream for locally processed surveillance footage.

This is deliberately browser-native: no WebRTC server is required for the
Phase-2 demo. Each requested job is processed into annotated JPEG frames and
served as multipart/x-mixed-replace.
"""
from __future__ import annotations
import asyncio
import cv2
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from ultralytics import YOLO
from .video_api import jobs

router=APIRouter(prefix="/api/video",tags=["video-preview"])

async def frames(job_id:str):
    job=jobs.get(job_id)
    if not job: return
    cap=cv2.VideoCapture(job["path"])
    if not cap.isOpened(): return
    model=YOLO("yolo11n.pt")
    try:
        while True:
            ok,frame=cap.read()
            if not ok: break
            result=model.track(frame,persist=True,conf=.45,verbose=False)[0]
            annotated=result.plot()
            ok,data=cv2.imencode(".jpg",annotated,[int(cv2.IMWRITE_JPEG_QUALITY),78])
            if ok:
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"+data.tobytes()+b"\r\n"
            await asyncio.sleep(0)
    finally: cap.release()

@router.get("/jobs/{job_id}/mjpeg")
async def processed_mjpeg(job_id:str):
    if job_id not in jobs: raise HTTPException(404,"Video job not found")
    return StreamingResponse(frames(job_id),media_type="multipart/x-mixed-replace; boundary=frame")
