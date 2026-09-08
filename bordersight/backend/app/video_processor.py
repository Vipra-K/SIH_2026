"""Single-pass background CCTV processor for the BorderSight MVP.

Uploaded footage is processed once through the shared inference pipeline.
The pipeline produces detections and annotated JPEG frames. This processor
handles BorderEngine rules, SSE events, and job progress.
"""

from __future__ import annotations

import asyncio
import cv2

from .border_engine import BorderEngine
from .event_bridge import publish_detection
from .video_api import jobs
from .frame_store import reset
from .inference_pipeline import analyze_frame


async def process_job(job_id: str) -> None:
    job = jobs.get(job_id)

    if not job:
        return

    job["status"] = "processing"
    job["progress"] = 0
    job["error"] = None

    # Clear any frames left over from a previous processing attempt.
    reset(job_id)

    cap = cv2.VideoCapture(job["path"])

    if not cap.isOpened():
        job["status"] = "failed"
        job["error"] = "Unable to open uploaded video"
        return

    engine = BorderEngine()

    frame_no = 0
    sequence = 0

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    total_frames = max(cap.get(cv2.CAP_PROP_FRAME_COUNT), 1)

    try:
        while True:
            ok, frame = cap.read()

            if not ok:
                break

            frame_no += 1

            # Process every second frame to keep CPU-based Phase-2 demos responsive.
            if frame_no % 2:
                continue

            # ---------------------------------------------------------
            # ONE AI INFERENCE PASS
            # ---------------------------------------------------------
            #
            # analyze_frame():
            #   - runs YOLO tracking
            #   - extracts detections
            #   - creates annotated JPEG
            #   - stores the JPEG in frame_store
            #
            result, detections = analyze_frame(
                job_id=job_id,
                frame=frame,
                sequence=sequence + 1,
            )

            sequence += 1

            # ---------------------------------------------------------
            # BORDER / BEHAVIOUR ANALYSIS
            # ---------------------------------------------------------

            events = []
            boxes = result.boxes

            if boxes is not None and boxes.id is not None:
                track_ids = boxes.id.int().cpu().tolist()
                coordinates = boxes.xyxy.cpu().tolist()

                for track_id, xyxy in zip(track_ids, coordinates):

                    # BorderEngine currently operates on people.
                    detection = next(
                        (
                            item
                            for item in detections
                            if item["track_id"] == track_id
                        ),
                        None,
                    )

                    if not detection:
                        continue

                    if detection["label"] != "person":
                        continue

                    x1, y1, x2, y2 = xyxy

                    center = (
                        ((x1 + x2) / 2) / frame.shape[1],
                        ((y1 + y2) / 2) / frame.shape[0],
                    )

                    events.extend(
                        engine.update(
                            int(track_id),
                            center,
                            frame_no / fps,
                            detection["label"],
                        )
                    )

            # ---------------------------------------------------------
            # REALTIME EVENT STREAM
            # ---------------------------------------------------------

            await publish_detection(
                {
                    "timestamp": frame_no / fps,
                    "detections": detections,
                    "events": events,
                    "source": "upload",
                    "job_id": job_id,
                },
                f"UPLOAD-{job_id}",
            )

            # ---------------------------------------------------------
            # PROCESSING PROGRESS
            # ---------------------------------------------------------

            current_frame = cap.get(cv2.CAP_PROP_POS_FRAMES)

            job["progress"] = round(
                (current_frame / total_frames) * 100,
                1,
            )

            # Give FastAPI's event loop an opportunity to handle
            # SSE clients and other requests.
            await asyncio.sleep(0)

        job["status"] = "completed"
        job["progress"] = 100

    except Exception as exc:
        job["status"] = "failed"
        job["error"] = str(exc)

    finally:
        cap.release()
