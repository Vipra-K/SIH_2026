# BorderSight AI — Architecture

## Core components

### Frontend

Operator-facing web application for command center monitoring, cameras, incidents, sectors, zones, and analytics.

### Backend

REST/WebSocket application responsible for authentication, camera/source configuration, sectors, zones, incidents, alerts, and analytics aggregation.

### AI engine

Pluggable video-processing service. The MVP can run against uploaded/demo video or a local camera. Production deployment can consume RTSP/NVR feeds through the same source interface.

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
        +--> Detector
        +--> Tracker
        +--> ZoneEngine
        +--> BehaviourEngine
        +--> RiskEngine
        +--> IncidentEngine
```

## Domain model

```text
Sector
  -> CameraSource
  -> Zone
  -> Incident

CameraSource
  -> Detection
  -> Event

TrackingSession
  -> Detection*
  -> BehaviourEvent*

Incident
  -> Evidence*
  -> TimelineEvent*
  -> Alert
```

## Incident lifecycle

`NEW -> ACKNOWLEDGED -> INVESTIGATING -> RESOLVED`

## Contextual risk

Risk is derived from multiple signals instead of a single detector result:

- event type
- zone severity
- time/schedule
- dwell duration
- movement direction
- group size
- confidence

The MVP uses a transparent weighted score so judges can understand why an incident was escalated.
