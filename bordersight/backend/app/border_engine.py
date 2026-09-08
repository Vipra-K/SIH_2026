from __future__ import annotations

from dataclasses import dataclass, field
from math import hypot
from typing import Dict, List, Tuple

Point = Tuple[float, float]


@dataclass
class TrackState:
    last_center: Point | None = None
    stationary_since: float | None = None


@dataclass
class BorderEngine:
    line_y: float = 0.55
    loiter_seconds: float = 12.0
    tracks: Dict[int, TrackState] = field(default_factory=dict)

    def update(self, track_id: int, center: Point, timestamp: float, label: str) -> List[dict]:
        state = self.tracks.setdefault(track_id, TrackState())
        events: List[dict] = []
        previous = state.last_center
        if previous and ((previous[1] < self.line_y <= center[1]) or (center[1] < self.line_y <= previous[1])):
            events.append(self._event("intrusion", track_id, label, timestamp, 82, "critical"))
        if previous and hypot(center[0] - previous[0], center[1] - previous[1]) < 0.006:
            state.stationary_since = state.stationary_since or timestamp
            if timestamp - state.stationary_since >= self.loiter_seconds:
                events.append(self._event("loitering", track_id, label, timestamp, 64, "high"))
                state.stationary_since = timestamp + 3600
        else:
            state.stationary_since = None
        state.last_center = center
        return events

    @staticmethod
    def _event(kind: str, track_id: int, label: str, timestamp: float, risk: int, severity: str) -> dict:
        return {"type": kind, "track_id": track_id, "label": label, "timestamp": timestamp, "risk_score": risk, "severity": severity}
