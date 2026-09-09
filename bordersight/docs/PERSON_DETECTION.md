# Person Detection

## What it does

BorderSight can detect people in both:

- **Live camera video**
- **Uploaded CCTV video**

The project uses the existing **YOLO11n + Ultralytics** Python pipeline. We do not use a second person-detection system.

## Live camera — simple flow

```text
Camera
  ↓
Browser shows live video
  ↓
Browser captures a frame every ~0.5 seconds
  ↓
Frame is sent to the FastAPI backend
  ↓
YOLO checks the frame
  ↓
Only PERSON detections are returned
  ↓
Browser draws boxes on the live camera
```

When a person is found, the camera view shows:

```text
┌──────────────────────────────┐
│  ┌──────────────────────┐    │
│  │ PERSON #3     94%    │    │
│  │                      │    │
│  │       person         │    │
│  └──────────────────────┘    │
│                              │
│  1 PERSON DETECTED            │
└──────────────────────────────┘
```

The box shows the person's location, confidence, and tracking ID when available.

## Uploaded video — simple flow

```text
Upload CCTV video
  ↓
Backend reads the video frame by frame
  ↓
YOLO detects and tracks people
  ↓
Person boxes are drawn on the processed frames
  ↓
Processed video is available through the existing video pipeline
```

The uploaded-video pipeline uses the same YOLO model and keeps the detection format consistent with live detection.

## What a detection contains

A detection looks like this:

```json
{
  "track_id": 3,
  "label": "person",
  "confidence": 0.94,
  "bbox": [420, 120, 610, 520]
}
```

- `label` — detected object type. For this feature it is `person`.
- `confidence` — how confident YOLO is about the detection.
- `bbox` — `[x1, y1, x2, y2]`, the person's box in the video frame.
- `track_id` — ID used to follow the same person across frames when tracking provides an ID.

## Live API

The browser sends camera frames to:

```text
POST /api/live/{camera_id}/frame
```

The response contains:

```json
{
  "camera_id": "CAM-01",
  "timestamp": 0,
  "detections": [],
  "person_detected": true,
  "person_count": 1,
  "source": "browser-camera"
}
```

The frontend uses `detections` to draw the boxes and uses `person_count` for the status message.

## Important point

The browser is **not running YOLO**. It only:

1. Shows the camera.
2. Captures a JPEG frame.
3. Sends it to the backend.
4. Receives the person coordinates.
5. Draws the detection box over the camera.

The Python backend performs the actual AI inference.

## Why the box is used

A message such as `PERSON DETECTED` tells the operator that someone is present, but it does not show where the person is.

The bounding box gives both pieces of information:

```text
Person detected + exact location in the frame
```

The status message is therefore secondary; the bounding box is the main visual indicator.

## Current scope

This feature is intentionally limited to **person detection and visualization**.

Restriction zones are the next layer:

```text
Person detection
      ↓
Person tracking
      ↓
Restriction-zone geometry
      ↓
Is the person inside the zone?
      ↓
Violation event
      ↓
Incident / alert
```

No restriction-zone rules are added by this feature yet.

## How to test

### Live camera

1. Start the BorderSight backend.
2. Start the frontend.
3. Open the Surveillance page.
4. Select a local camera/phone webcam.
5. Click **Start Camera**.
6. Stand in front of the camera.
7. YOLO should detect the person.
8. A box and `PERSON` label should appear over the person.
9. The status indicator should show the number of detected people.

### Uploaded video

1. Start the BorderSight backend.
2. Open the existing video-upload flow.
3. Upload a CCTV video containing a person.
4. Wait for processing to finish.
5. Open the processed video/MJPEG output.
6. Person boxes should appear on the processed frames.

## Files involved

```text
bordersight/
├── backend/app/
│   ├── inference_pipeline.py      # Shared YOLO inference + uploaded-video annotations
│   └── live_camera_api.py         # Live camera person-detection API
│
├── frontend/
│   ├── app/operate/page.tsx       # Surveillance camera UI
│   └── components/
│       └── PersonDetectionOverlay.tsx  # Live boxes + detection status
│
└── docs/
    └── PERSON_DETECTION.md        # This document
```
