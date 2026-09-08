"""Camera-source API for the BorderSight MVP."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


class CameraSource(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    source_type: str = Field(pattern="^(webcam|video|rtsp)$")
    source: str


sources: dict[str, CameraSource] = {
    "phone-webcam": CameraSource(name="Phone / Webcam", source_type="webcam", source="0"),
}


@router.get("")
async def list_cameras():
    return [{"id": key, **value.model_dump(), "status": "ready"} for key, value in sources.items()]


@router.post("")
async def add_camera(camera: CameraSource):
    camera_id = camera.name.lower().replace(" ", "-")[:40]
    sources[camera_id] = camera
    return {"id": camera_id, **camera.model_dump(), "status": "ready"}


@router.delete("/{camera_id}")
async def remove_camera(camera_id: str):
    if camera_id == "phone-webcam":
        return {"id": camera_id, "status": "disabled"}
    sources.pop(camera_id, None)
    return {"id": camera_id, "status": "removed"}
