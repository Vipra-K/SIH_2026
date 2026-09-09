"""Smoke tests for browser/phone live-camera ingestion."""

import sys
from pathlib import Path

from fastapi.testclient import TestClient

# The backend app is exposed from backend/main.py, while its supporting
# modules live under backend/app/. Keep the test import layout consistent
# with test_main.py and with the documented backend execution layout.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from main import app  # noqa: E402

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
