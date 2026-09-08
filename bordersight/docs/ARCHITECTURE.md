# BorderSight AI — Architecture

## Core components

### Frontend

Operator-facing Next.js application for command-center monitoring, cameras, incidents, sectors, zones and analytics.

### Backend

FastAPI application responsible for the MVP REST API, video ingestion, incident state, virtual zones and realtime event delivery.

### AI engine

Python/OpenCV/Ultralytics processing pipeline. The MVP supports uploaded/demo video and local camera workflows. RTSP is a future production source.

## Current processing flow

```text
Video upload / local source
        |
        v
   Video processing
        |
        v
 YOLO detection + tracking
        |
        +----> annotated JPEG -> bounded frame store -> MJPEG preview
        |
        v
    BorderEngine
        |
        +----> intrusion / loitering events
        |
        v
   Event bridge
        |
        +----> SSE realtime stream
        |
        +----> incident store
        |
        v
    Operator UI
```

The inference pipeline is single-pass: the same annotated frames produced during inference are placed in the bounded frame store and reused by the browser preview. The YOLO model is lazy-loaded when inference is first requested so normal API startup/tests do not require model initialization.

## Source abstraction

```text
VideoFileSource
LocalCameraSource
RTSPSource (future/production)
        |
        v
    VideoSource
        |
        v
  FrameProcessor
        |
        +--> Detector / Tracker
        +--> BorderEngine
        +--> Risk scoring
        +--> Incident bridge
```

## Domain model

```text
CameraSource
  -> Detection
  -> Event
  -> Incident

TrackingSession
  -> Detection*
  -> BehaviourEvent*

Incident
  -> operator status
  -> realtime notification
  -> evidence frames (MVP)
```

## Incident lifecycle

Current backend:

`UNRESOLVED -> ACKNOWLEDGED -> RESOLVED`

`INVESTIGATING` is planned but is not currently implemented in the backend enum.

## Contextual risk

The MVP uses a transparent weighted score:

- restricted-zone crossing: +50
- loitering >= 60 seconds: +20
- movement toward border: +20
- low-light condition: +10

The resulting score is capped at 100 and mapped to a severity level. This makes the escalation decision explainable during the SIH demonstration.

## Realtime transport

The current implementation uses Server-Sent Events (SSE) at:

`GET /api/stream/events`

A WebSocket transport is not currently implemented.

## Persistence

The current Phase-2 MVP intentionally uses in-memory stores. This keeps the demo lightweight but means data is lost when the backend process restarts. A production deployment should replace these stores with durable persistence and add authentication, authorization, audit logging and operational monitoring.
