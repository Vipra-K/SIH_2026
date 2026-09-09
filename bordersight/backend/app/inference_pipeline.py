"""Shared inference helpers for uploaded surveillance footage."""
from __future__ import annotations

from functools import lru_cache

import cv2
from ultralytics import YOLO

from .frame_store import append


PERSON_CLASS_ID = 0
CONFIDENCE_THRESHOLD = 0.45


@lru_cache(maxsize=1)
def get_model() -> YOLO:
    """Load the YOLO model only when inference is actually requested."""
    return YOLO("yolo11n.pt")


def _person_annotations(result, frame):
    """Return person detections and a frame annotated with person boxes."""
    detections = []
    annotated = frame.copy()
    boxes = result.boxes
    if boxes is None:
        return detections, annotated

    ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(boxes)
    classes = boxes.cls.int().cpu().tolist()
    scores = boxes.conf.cpu().tolist()
    coords = boxes.xyxy.cpu().tolist()

    for track_id, cls_id, score, xyxy in zip(ids, classes, scores, coords):
        if int(cls_id) != PERSON_CLASS_ID:
            continue

        x1, y1, x2, y2 = [int(round(v)) for v in xyxy]
        confidence = float(score)
        detections.append(
            {
                "track_id": track_id,
                "label": "person",
                "confidence": confidence,
                "bbox": [float(v) for v in xyxy],
            }
        )

        label = f"PERSON {confidence:.0%}"
        if track_id is not None:
            label += f"  #{int(track_id)}"
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (255, 190, 0), 2)
        text_y = max(24, y1 - 8)
        cv2.rectangle(
            annotated,
            (x1, max(0, text_y - 22)),
            (min(frame.shape[1] - 1, x1 + 190), text_y + 2),
            (255, 190, 0),
            -1,
        )
        cv2.putText(
            annotated,
            label,
            (x1 + 6, text_y - 5),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (20, 20, 20),
            2,
            cv2.LINE_AA,
        )

    return detections, annotated


def analyze_frame(job_id: str, frame, sequence: int):
    result = get_model().track(
        frame, persist=True, conf=CONFIDENCE_THRESHOLD, verbose=False
    )[0]
    detections, annotated = _person_annotations(result, frame)

    ok, encoded = cv2.imencode(
        ".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 78]
    )
    if ok:
        append(job_id, sequence, encoded.tobytes())
    return result, detections
