"""Persistent operator-managed virtual restricted zones."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/zones", tags=["zones"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "bordersight.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def _init_db() -> None:
    with _connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS restriction_zones (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                camera_id TEXT NOT NULL,
                points TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'HIGH',
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_restriction_zones_camera ON restriction_zones(camera_id)"
        )


_init_db()


class Zone(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    camera_id: str = Field(min_length=1, max_length=80)
    points: list[list[float]] = Field(min_length=3)
    severity: str = Field(default="HIGH", min_length=1, max_length=20)
    enabled: bool = True


class ZoneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    points: list[list[float]] | None = Field(default=None, min_length=3)
    severity: str | None = Field(default=None, min_length=1, max_length=20)
    enabled: bool | None = None


def _validate_points(points: list[list[float]]) -> None:
    if len(points) < 3:
        raise HTTPException(422, "A restriction zone needs at least three points")
    if any(len(point) != 2 for point in points):
        raise HTTPException(422, "Each zone point must contain x and y coordinates")
    if any(not (0 <= point[0] <= 1 and 0 <= point[1] <= 1) for point in points):
        raise HTTPException(422, "Zone coordinates must be normalized between 0 and 1")


def _row_to_zone(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "camera_id": row["camera_id"],
        "points": json.loads(row["points"]),
        "severity": row["severity"],
        "enabled": bool(row["enabled"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


@router.get("")
async def list_zones(camera_id: str | None = None, include_disabled: bool = True):
    query = "SELECT * FROM restriction_zones"
    params: list[object] = []
    conditions: list[str] = []
    if camera_id:
        conditions.append("camera_id = ?")
        params.append(camera_id)
    if not include_disabled:
        conditions.append("enabled = 1")
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY created_at ASC"
    with _connect() as connection:
        rows = connection.execute(query, params).fetchall()
    return [_row_to_zone(row) for row in rows]


@router.post("", status_code=201)
async def create_zone(zone: Zone):
    _validate_points(zone.points)
    zone_id = f"ZONE-{uuid4().hex[:8].upper()}"
    with _connect() as connection:
        connection.execute(
            "INSERT INTO restriction_zones (id, name, camera_id, points, severity, enabled) VALUES (?, ?, ?, ?, ?, ?)",
            (zone_id, zone.name, zone.camera_id, json.dumps(zone.points), zone.severity, int(zone.enabled)),
        )
        row = connection.execute("SELECT * FROM restriction_zones WHERE id = ?", (zone_id,)).fetchone()
    return _row_to_zone(row)


@router.patch("/{zone_id}")
async def update_zone(zone_id: str, update: ZoneUpdate):
    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(400, "No changes supplied")
    if "points" in changes:
        _validate_points(changes["points"])

    assignments: list[str] = []
    params: list[object] = []
    for field in ("name", "severity", "enabled"):
        if field in changes:
            assignments.append(f"{field} = ?")
            params.append(int(changes[field]) if field == "enabled" else changes[field])
    if "points" in changes:
        assignments.append("points = ?")
        params.append(json.dumps(changes["points"]))
    assignments.append("updated_at = CURRENT_TIMESTAMP")
    params.append(zone_id)

    with _connect() as connection:
        cursor = connection.execute(
            f"UPDATE restriction_zones SET {', '.join(assignments)} WHERE id = ?", params
        )
        if cursor.rowcount == 0:
            raise HTTPException(404, "Zone not found")
        row = connection.execute("SELECT * FROM restriction_zones WHERE id = ?", (zone_id,)).fetchone()
    return _row_to_zone(row)


@router.delete("/{zone_id}")
async def delete_zone(zone_id: str):
    with _connect() as connection:
        cursor = connection.execute("DELETE FROM restriction_zones WHERE id = ?", (zone_id,))
    if cursor.rowcount == 0:
        raise HTTPException(404, "Zone not found")
    return {"id": zone_id, "status": "removed"}
