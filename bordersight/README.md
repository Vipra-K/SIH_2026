# BorderSight AI

SIH 2026 PS 187 — Border Surveillance Intelligence Platform.

## Phase-2 MVP

BorderSight is a camera-agnostic surveillance command center. The prototype can consume prerecorded video or a local camera and represents each source as a surveillance camera. The MVP focuses on the operational loop:

**video source → detection → tracking → virtual border zone → contextual risk → incident → operator response**

### MVP modules

- Command Center
- Camera/source management
- Detection and tracking adapter
- Border zones and virtual lines
- Intrusion and loitering events
- Contextual risk scoring
- Incident management and investigation
- Sector overview
- Basic analytics

### Design principle

Do not couple the product to physical CCTV hardware. The ingestion interface is intentionally source-agnostic so demo video, a laptop/phone camera, and future RTSP CCTV feeds can use the same analytics and incident pipeline.

## Planned stack

- Frontend: Next.js + TypeScript + Tailwind/shadcn-style UI
- Backend: FastAPI
- AI engine: Python, OpenCV and YOLO-compatible detector/tracker adapter
- Storage: SQLite for MVP, PostgreSQL-ready model
- Events: REST first, WebSocket-ready

## Demo scenario

1. Start a demo surveillance source.
2. Open a sector camera.
3. Person appears and receives a tracking ID.
4. Person crosses a configured restricted line.
5. BorderSight calculates contextual risk and creates an incident.
6. Operator opens the incident, reviews evidence/timeline, acknowledges it and resolves it.

This repository contains an SIH prototype, not a production security system. Detection results must be treated as decision support and verified by authorized personnel.
