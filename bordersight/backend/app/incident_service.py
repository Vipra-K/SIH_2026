"""Runtime incident persistence bridge for AI-generated events."""
from __future__ import annotations
from datetime import datetime, timezone


def record_ai_event(event: dict, camera_id: str) -> None:
    """Append an AI event to the MVP incident store used by the API.

    The import is intentionally lazy so the service does not create a startup
    cycle: main.py owns the lightweight in-memory models for Phase-2.
    """
    try:
        from app import main
        camera = next((c for c in main.cameras if c.id == camera_id or c.id == camera_id.replace("UPLOAD-", "")), None)
        if camera is None:
            camera_id_for_record = camera_id
            sector = "Unknown"
        else:
            camera_id_for_record = camera.id
            sector = camera.sector
        score = max(0, min(100, int(event.get("risk_score", 0))))
        severity_name = str(event.get("severity", "medium")).upper()
        severity = getattr(main.Severity, severity_name.lower(), main.Severity.medium)
        incident_type = str(event.get("type", "ANOMALY")).upper()
        track_id = str(event.get("track_id", "unknown"))
        confidence = float(event.get("confidence", 0.0))
        incident = main.Incident(
            id=f"INC-{1000 + len(main.incidents) + 1}",
            type=incident_type,
            camera_id=camera_id_for_record,
            sector=sector,
            timestamp=datetime.now(timezone.utc).isoformat(),
            object_type=str(event.get("label", "unknown")).upper(),
            track_id=track_id,
            confidence=max(0.0, min(1.0, confidence)),
            risk_score=score,
            severity=severity,
            status=main.IncidentStatus.unresolved,
            reason=[str(event.get("message", "AI rule triggered"))],
        )
        # Avoid duplicate alerts for the same track/event arriving twice.
        duplicate = any(i.camera_id == incident.camera_id and i.track_id == incident.track_id and i.type == incident.type for i in main.incidents[:20])
        if not duplicate:
            main.incidents.insert(0, incident)
    except Exception:
        # Realtime delivery must not be taken down by optional persistence.
        return
