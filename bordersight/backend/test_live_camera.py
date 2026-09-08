"""Smoke tests for browser/phone live-camera ingestion."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_live_camera_rejects_empty_frame():
    response = client.post("/api/live/CAM-02/frame", content=b"")
    assert response.status_code == 400
    assert response.json()["detail"] == "Empty camera frame"


def test_live_camera_rejects_invalid_frame():
    response = client.post(
        "/api/live/CAM-02/frame",
        content=b"not-a-jpeg",
        headers={"Content-Type": "image/jpeg"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid JPEG camera frame"
