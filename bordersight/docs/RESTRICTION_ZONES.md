# Restriction Zones

## Simple idea

A restriction zone is an area drawn by the operator on a camera view. The operator creates it once, gives it a name, and saves it.

The zone is then stored by the backend for that camera. When the same camera is opened again, the saved zone is loaded automatically.

## How the operator creates a zone

1. Start the camera.
2. Click **Create Restricted Zone**.
3. Click at least three points around the area that must be restricted.
4. The outline and shaded area appear while the operator is drawing.
5. Enter a name such as `North Gate` or `Storage Area`.
6. Click **Save Zone**.

The coordinates are stored as normalized values from `0` to `1`. This keeps the zone in the correct position even when the camera view is resized.

## What is stored

Each zone contains:

- `id` - unique zone ID
- `camera_id` - the camera this zone belongs to
- `name` - operator-provided name
- `points` - polygon points
- `severity` - current alert severity
- `enabled` - whether the zone is active

The backend stores these records in SQLite at `backend/data/bordersight.db`. The database file is intentionally ignored by Git so local runtime data is not committed to the repository.

## What happens when the camera opens

The frontend requests:

```text
GET /api/zones?camera_id=CAM-01
```

The backend returns all zones saved for that camera. Enabled zones are drawn over the video automatically.

The operator does not need to draw the zone again.

## Disable vs delete

- **Disable** keeps the zone saved but stops treating it as active.
- **Enable** activates a previously disabled zone again.
- **Delete** permanently removes the zone from the backend database.

## Current phase

This phase provides the persistent zone editor and storage. The next step is to connect these polygons to person tracking so the backend can determine when a tracked person's position enters an active restricted zone and create a violation event.
