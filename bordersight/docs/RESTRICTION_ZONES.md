# Restriction Zones

## Simple idea

A restriction zone is an area drawn by the operator on a camera view. The operator creates it once, gives it a name, and saves it.

The zone is stored by the backend for that camera. When the same camera is opened again, the saved zone is loaded automatically.

## How the operator creates a zone

1. Start the camera.
2. Click **Create Restricted Zone**.
3. Click at least three points around the area that must be restricted.
4. The outline, points, and shaded area appear while the operator is drawing.
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

The backend returns the zones saved for that camera. Enabled zones are drawn over the video automatically.

The operator does not need to draw the zone again.

## Person + zone detection

For every detected person, the backend uses the **bottom-center of the person's bounding box** as the person's ground position. It checks that point against every enabled polygon using a point-in-polygon test.

```text
YOLO person detection
        ↓
Person tracking ID + bounding box
        ↓
Bottom-center point
        ↓
Point inside saved zone?
      /       \
    No         Yes
    ↓           ↓
  Normal     Restricted
              violation
```

A live person inside a zone is shown with a red detection box and a `RESTRICTED ZONE VIOLATION` status. The backend also emits a zone-entry event.

The violation engine keeps state by `camera + zone + track ID`, so a person staying inside a zone does not generate a new event on every frame. A new event is generated when that tracked person enters the zone again.

The same zone check is available to the uploaded-video inference pipeline when a video job is associated with a camera ID.

## Disable vs delete

- **Disable** keeps the zone saved but stops treating it as active.
- **Enable** activates a previously disabled zone again.
- **Delete** permanently removes the zone from the backend database.

## Current implementation

The feature is implemented on the `features` branch with:

- Persistent SQLite-backed zone storage
- Camera-specific zones
- Polygon drawing directly over the live camera
- Zone naming and save workflow
- Enable/disable/delete controls
- Live person-to-zone membership checks
- Restricted-zone entry events
- Uploaded-video zone checks

The next refinement should be operational testing with a real camera/video and then tuning boundary/debounce behavior if needed.
