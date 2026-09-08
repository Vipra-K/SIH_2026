"""Operator-managed virtual restricted zones for the MVP."""
from __future__ import annotations
from uuid import uuid4
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/zones", tags=["zones"])
class Zone(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    camera_id: str
    points: list[list[float]] = Field(min_length=3)
    severity: str = "HIGH"

zones: dict[str, Zone] = {}
@router.get("")
async def list_zones(): return [{"id": k, **v.model_dump()} for k,v in zones.items()]
@router.post("")
async def create_zone(zone: Zone):
    zid=f"ZONE-{uuid4().hex[:8].upper()}"; zones[zid]=zone; return {"id":zid,**zone.model_dump()}
@router.delete("/{zone_id}")
async def delete_zone(zone_id:str):
    if zone_id not in zones: raise HTTPException(404,"Zone not found")
    zones.pop(zone_id); return {"id":zone_id,"status":"removed"}
