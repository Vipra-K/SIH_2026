"""Rule engine for turning tracked detections into border events."""
from __future__ import annotations

from dataclasses import dataclass, field
from math import hypot
from typing import Dict, List, Tuple

Point = Tuple[float, float]


@dataclass
class TrackState:
    last_center: Point | None = None
    first_seen: float = 0.0
    last_seen: float = 0.0
    stationary_since: float | None = None


@dataclass
class BorderEngine:
    line_start: Point = (0.2, 0.55)
    line_end: Point = (0.8, 0.55)
    loiter_seconds: float = 12.0
    restricted_zone: Tuple[float, float, float, float] = (0.05, 0.05, 0.95, 0.95)
    tracks: Dict[int, TrackState] = field(default_factory=dict)

    def update(self, track_id: int, center: Point, timestamp: float, label: str) -> List[dict]:
        state = self.tracks.setdefault(track_id, TrackState(first_seen=timestamp))
        events: List[dict] = []
        previous = state.last_center

        if previous is not None and self._crossed(previous, center):
            events.append(self._event("intrusion", track_id, label, timestamp, 82, "critical"))

        if previous is not None and hypot(center[0] - previous[0], center[1] - previous[1]) < 0.006:
            state.stationary_since = state.stationary_since or timestamp
            if timestamp - state.stationary_since >= self.loiter_seconds:
                events.append(self._event("loitering", track_id, label, timestamp, 64, "high"))
                state.stationary_since = timestamp + 3600
        else:
            state.stationary_since = None

        state.last_center = center
        state.last_seen = timestamp
        return events

    def _crossed(self, a: Point, b: Point) -> bool:
        # Normalized horizontal virtual boundary; crossing from either side counts.
        y = self.line_start[1]
        return (a[1] < y <= b[1]) or (b[1] < y <= a[1])

    @staticmethod
    def _event(kind: str, track_id: int, label: str, timestamp: float, risk: int, severity: str) -> dict:
        return {
            "type": kind,
            "track_id": track_id,
            "label": label,
            "timestamp": timestamp,
            "risk_score": risk,
            "severity": severity,
        }
