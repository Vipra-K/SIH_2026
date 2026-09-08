from __future__ import annotations

from dataclasses import dataclass
from math import hypot
from time import time


@dataclass
class Detection:
    label: str
    confidence: float
    track_id: int | None
    bbox: list[float]

    @property
    def center(self) -> tuple[float, float]:
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)


class BorderEventEngine:
    """Turns detector tracks into operational border events.

    The detector remains independent: this class accepts normalized detection
    dictionaries, so prerecorded video, a phone camera, RTSP, or another
    detector can feed the exact same rule engine.
    """

    def __init__(self) -> None:
        self.previous: dict[int, tuple[float, float]] = {}
        self.loiter_started: dict[int, float] = {}

    @staticmethod
    def crossed_line(previous: tuple[float, float], current: tuple[float, float], line_y: float) -> bool:
        return (previous[1] < line_y <= current[1]) or (previous[1] > line_y >= current[1])

    def evaluate(self, detections: list[dict], line_y: float, loiter_seconds: int = 20) -> list[dict]:
        now = time()
        events: list[dict] = []
        for raw in detections:
            if raw.get("label") != "person" or raw.get("track_id") is None:
                continue
            track_id = int(raw["track_id"])
            d = Detection(raw["label"], float(raw["confidence"]), track_id, raw["bbox"])
            current = d.center
            previous = self.previous.get(track_id)
            if previous and self.crossed_line(previous, current, line_y):
                events.append({
                    "type": "intrusion",
                    "track_id": track_id,
                    "severity": "high",
                    "confidence": d.confidence,
                    "message": "Tracked person crossed the restricted border line",
                })
            if track_id not in self.loiter_started:
                self.loiter_started[track_id] = now
            elif now - self.loiter_started[track_id] >= loiter_seconds:
                events.append({
                    "type": "loitering",
                    "track_id": track_id,
                    "severity": "medium",
                    "confidence": d.confidence,
                    "message": f"Tracked person remained in the monitored zone for {loiter_seconds}+ seconds",
                })
                self.loiter_started[track_id] = now
            self.previous[track_id] = current
        return events
