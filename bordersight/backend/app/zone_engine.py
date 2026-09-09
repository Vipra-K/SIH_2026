"""Geometry and state helpers for camera-specific restriction zones."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ZoneViolationEngine:
    """Checks tracked person positions against saved polygons.

    A violation is emitted only when a tracked person enters a zone. Keeping
    state per camera/zone/track prevents one alert per video frame while the
    person remains inside the same zone.
    """

    active: set[tuple[str, str, int]] = field(default_factory=set)

    @staticmethod
    def point_in_polygon(x: float, y: float, points: list[list[float]]) -> bool:
        inside = False
        j = len(points) - 1
        for i, point in enumerate(points):
            xi, yi = point
            xj, yj = points[j]
            intersects = ((yi > y) != (yj > y)) and (
                x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
            )
            if intersects:
                inside = not inside
            j = i
        return inside

    @staticmethod
    def feet_point(bbox: list[float], width: int, height: int) -> tuple[float, float]:
        x1, _, x2, y2 = bbox
        return ((x1 + x2) / 2 / width, y2 / height)

    def evaluate(
        self,
        camera_id: str,
        track_id: int | None,
        bbox: list[float],
        width: int,
        height: int,
        zones: list[dict],
    ) -> tuple[list[dict], list[dict]]:
        """Return (zones_containing_person, newly_entered_zone_events)."""
        if track_id is None or width <= 0 or height <= 0:
            return [], []

        x, y = self.feet_point(bbox, width, height)
        containing: list[dict] = []
        entered: list[dict] = []
        current_keys: set[tuple[str, str, int]] = set()

        for zone in zones:
            if not zone.get("enabled", True):
                continue
            zone_id = str(zone["id"])
            if self.point_in_polygon(x, y, zone["points"]):
                key = (camera_id, zone_id, int(track_id))
                current_keys.add(key)
                containing.append({"id": zone_id, "name": zone["name"], "severity": zone.get("severity", "HIGH")})
                if key not in self.active:
                    entered.append({
                        "type": "restriction_zone_entry",
                        "camera_id": camera_id,
                        "zone_id": zone_id,
                        "zone_name": zone["name"],
                        "track_id": int(track_id),
                        "severity": zone.get("severity", "HIGH"),
                        "message": f"Person #{int(track_id)} entered restricted zone '{zone['name']}'",
                    })

        self.active.difference_update({key for key in self.active if key[0] == camera_id and key[2] == int(track_id) and key not in current_keys})
        self.active.update(current_keys)
        return containing, entered

    def clear_camera(self, camera_id: str) -> None:
        self.active = {key for key in self.active if key[0] != camera_id}
