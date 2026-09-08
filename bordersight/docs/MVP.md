# BorderSight AI — Phase 2 MVP

## Product goal

Demonstrate an end-to-end border surveillance workflow without requiring physical CCTV hardware.

## Demo flow

1. Add a virtual camera backed by a video file or local camera.
2. Start the stream in the Command Center.
3. Detect and track people/vehicles.
4. Configure a virtual restricted boundary.
5. Generate an intrusion event when a tracked person crosses the boundary.
6. Calculate contextual risk.
7. Create an incident and operator alert.
8. Open the incident investigation view.
9. Acknowledge and resolve the incident.
10. Show event analytics by sector and camera.

## MVP screens

- Command Center
- Camera Management
- Camera Detail / Live Analysis
- Zone & Boundary Configuration
- Incidents
- Incident Investigation
- Analytics
- Sectors
- Settings / Operator profile

## Priorities

### P0

- Video ingestion abstraction
- Person detection
- Object tracking
- Virtual line/zone
- Intrusion detection
- Incident creation
- Risk score
- Alert center
- Investigation timeline

### P1

- Loitering detection
- Vehicle detection
- Sector map
- Camera health/status
- Basic analytics

### Future

- Abandoned object detection
- Multi-camera correlation/re-identification
- Advanced anomaly detection
- Edge inference
- RTSP/NVR deployment

## Design principles

- Border-specific, not generic CCTV management.
- Evidence-first incidents, not noisy per-frame alerts.
- Camera-agnostic ingestion so demo sources can later be replaced by existing CCTV/RTSP feeds.
- Clean operator workflow with severity, confidence, timestamps, zones, and incident lifecycle.
