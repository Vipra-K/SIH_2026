"""Backend API and core behavior regression tests."""

import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.border_engine import BorderEngine  # noqa: E402
from app.frame_store import after, append, reset  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "status": "ok",
        "service": "bordersight-api",
        "version": "0.4.0",
    }


def test_dashboard_shape():
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    body = response.json()
    assert body["cameras"]["total"] >= body["cameras"]["online"]
    assert body["incidents"]["active"] >= body["incidents"]["critical"]
    assert isinstance(body["sectors"], list)


def test_cameras_and_incidents_endpoints():
    cameras = client.get("/api/cameras")
    incidents = client.get("/api/incidents")

    assert cameras.status_code == 200
    assert incidents.status_code == 200
    assert len(cameras.json()) >= 1
    assert len(incidents.json()) >= 1


def test_incident_not_found():
    response = client.get("/api/incidents/DOES-NOT-EXIST")
    assert response.status_code == 404


def test_event_threshold_does_not_create_low_risk_incident():
    response = client.post(
        "/api/events",
        json={
            "camera_id": "CAM-01",
            "object_type": "PERSON",
            "track_id": "TEST-LOW",
            "confidence": 0.90,
            "crossed_restricted_boundary": False,
            "loiter_seconds": 10,
            "toward_border": False,
            "low_light": False,
        },
    )
    assert response.status_code == 200
    assert response.json() is None


def test_high_risk_event_creates_incident():
    response = client.post(
        "/api/events",
        json={
            "camera_id": "CAM-01",
            "object_type": "PERSON",
            "track_id": "TEST-HIGH",
            "confidence": 0.97,
            "crossed_restricted_boundary": True,
            "loiter_seconds": 90,
            "toward_border": True,
            "low_light": True,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "LOITERING"
    assert body["risk_score"] == 100
    assert body["status"] == "UNRESOLVED"


def test_unknown_camera_event_is_rejected():
    response = client.post(
        "/api/events",
        json={
            "camera_id": "CAM-UNKNOWN",
            "track_id": "TEST-UNKNOWN",
            "confidence": 0.8,
        },
    )
    assert response.status_code == 404


def test_incident_status_update():
    response = client.patch(
        "/api/incidents/INC-1042/status",
        json={"status": "ACKNOWLEDGED"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ACKNOWLEDGED"


def test_border_engine_detects_boundary_crossing():
    engine = BorderEngine()
    assert engine.update(1, (0.5, 0.40), 1.0, "person") == []
    events = engine.update(1, (0.5, 0.60), 2.0, "person")
    assert len(events) == 1
    assert events[0]["type"] == "intrusion"
    assert events[0]["risk_score"] == 82
    assert events[0]["severity"] == "critical"


def test_border_engine_detects_loitering():
    engine = BorderEngine(loiter_seconds=5)
    engine.update(7, (0.5, 0.40), 0.0, "person")
    engine.update(7, (0.501, 0.401), 1.0, "person")
    events = engine.update(7, (0.5015, 0.4015), 6.1, "person")
    assert any(event["type"] == "loitering" for event in events)


def test_border_engine_resets_loitering_after_movement():
    engine = BorderEngine(loiter_seconds=5)
    engine.update(8, (0.5, 0.40), 0.0, "person")
    engine.update(8, (0.501, 0.401), 1.0, "person")
    engine.update(8, (0.20, 0.20), 2.0, "person")
    events = engine.update(8, (0.201, 0.201), 6.0, "person")
    assert not any(event["type"] == "loitering" for event in events)


def test_frame_store_returns_only_new_frames_and_is_bounded():
    job_id = "CI-FRAMES"
    reset(job_id)
    append(job_id, 1, b"one")
    append(job_id, 2, b"two")
    assert after(job_id, 0) == [
        {"sequence": 1, "jpeg": b"one"},
        {"sequence": 2, "jpeg": b"two"},
    ]
    assert after(job_id, 1) == [{"sequence": 2, "jpeg": b"two"}]
