"""BorderSight demo runner.

Accepts a local video path or webcam index and emits structured detections.
The output is intentionally simple so the API/UI can consume it later.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import cv2
from ultralytics import YOLO


def main() -> None:
    parser = argparse.ArgumentParser(description="Run BorderSight detection on video/webcam")
    parser.add_argument("source", help="Video path, camera index (0), or URL supported by OpenCV")
    parser.add_argument("--model", default="yolo11n.pt")
    parser.add_argument("--output", default="data/events.jsonl")
    parser.add_argument("--confidence", type=float, default=0.45)
    args = parser.parse_args()

    source: object = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise SystemExit(f"Unable to open video source: {args.source}")

    model = YOLO(args.model)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    with output.open("a", encoding="utf-8") as events:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            result = model.track(frame, persist=True, conf=args.confidence, verbose=False)[0]
            boxes = result.boxes
            timestamp = time.time()
            detections = []

            if boxes is not None:
                ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(boxes)
                classes = boxes.cls.int().cpu().tolist()
                scores = boxes.conf.cpu().tolist()
                coords = boxes.xyxy.cpu().tolist()
                names = result.names
                for track_id, cls_id, score, xyxy in zip(ids, classes, scores, coords):
                    detections.append({
                        "track_id": track_id,
                        "class_id": cls_id,
                        "label": names[int(cls_id)],
                        "confidence": round(float(score), 4),
                        "bbox": [round(float(v), 2) for v in xyxy],
                    })

            events.write(json.dumps({
                "timestamp": timestamp,
                "source": str(args.source),
                "frame_width": frame.shape[1],
                "frame_height": frame.shape[0],
                "detections": detections,
            }) + "\n")
            events.flush()

            cv2.imshow("BorderSight AI — Demo", result.plot())
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
