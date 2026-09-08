import sys
from pathlib import Path

from fastapi.testclient import TestClient

# Allow running this file directly from bordersight/backend or via pytest.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from main import app  # noqa: E402

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "bordersight-api"


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
