"""Bridge AI events into the realtime dashboard and incident API."""
from __future__ import annotations

from .realtime import hub


def severity_for(score: int) -> str:
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


async def publish_detection(frame: dict, camera_id: str) -> None:
    await hub.publish({
        "kind": "detection",
        "camera_id": camera_id,
        "timestamp": frame.get("timestamp"),
        "detections": frame.get("detections", []),
    })

    for event in frame.get("events", []):
        score = int(event.get("risk_score", 0))
        await hub.publish({
            "kind": "incident",
            "camera_id": camera_id,
            "type": event.get("type", "ANOMALY").upper(),
            "track_id": event.get("track_id"),
            "object_type": event.get("label", "unknown").upper(),
            "risk_score": score,
            "severity": event.get("severity", severity_for(score)).upper(),
            "timestamp": event.get("timestamp"),
        })
