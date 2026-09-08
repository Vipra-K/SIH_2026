"""Camera/video agnostic YOLO inference adapter for the BorderSight MVP."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterator

import cv2
from ultralytics import YOLO


class VisionEngine:
    def __init__(self, model_path: str = "yolo11n.pt", confidence: float = 0.35):
        self.model = YOLO(model_path)
        self.confidence = confidence

    def process(self, source: str | int) -> Iterator[dict]:
        results = self.model.track(source=source, stream=True, persist=True, conf=self.confidence, verbose=False)
        for frame_index, result in enumerate(results):
            boxes = []
            if result.boxes is not None:
                names = result.names
                for box in result.boxes:
                    cls = int(box.cls[0])
                    confidence = float(box.conf[0])
                    xyxy = [round(float(v), 2) for v in box.xyxy[0].tolist()]
                    track_id = int(box.id[0]) if box.id is not None else None
                    boxes.append({
                        "class_id": cls,
                        "label": names.get(cls, str(cls)),
                        "confidence": round(confidence, 3),
                        "track_id": track_id,
                        "bbox": xyxy,
                    })
            yield {"frame": frame_index, "width": result.orig_shape[1], "height": result.orig_shape[0], "objects": boxes}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", help="Video path, webcam index, or camera URL")
    parser.add_argument("--model", default="yolo11n.pt")
    parser.add_argument("--confidence", type=float, default=0.35)
    parser.add_argument("--jsonl", type=Path)
    args = parser.parse_args()

    source: str | int = int(args.source) if args.source.isdigit() else args.source
    engine = VisionEngine(args.model, args.confidence)
    writer = args.jsonl.open("w", encoding="utf-8") if args.jsonl else None
    try:
        for event in engine.process(source):
            line = json.dumps(event)
            print(line)
            if writer:
                writer.write(line + "\n")
    finally:
        if writer:
            writer.close()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
