# BorderSight AI — MVP API Contract

## Cameras

`GET /api/cameras`

`POST /api/cameras`

`GET /api/cameras/:cameraId`

`PATCH /api/cameras/:cameraId`

`POST /api/cameras/:cameraId/start`

`POST /api/cameras/:cameraId/stop`

## Zones

`GET /api/cameras/:cameraId/zones`

`POST /api/cameras/:cameraId/zones`

`PATCH /api/zones/:zoneId`

`DELETE /api/zones/:zoneId`

## Incidents

`GET /api/incidents`

`GET /api/incidents/:incidentId`

`PATCH /api/incidents/:incidentId/status`

`POST /api/incidents/:incidentId/acknowledge`

`POST /api/incidents/:incidentId/resolve`

## Dashboard

`GET /api/dashboard/summary`

`GET /api/dashboard/events`

`GET /api/dashboard/sectors`

## Realtime

WebSocket `/ws/events` publishes:

- `detection.created`
- `tracking.updated`
- `incident.created`
- `incident.updated`
- `camera.status_changed`

## Example incident

```json
{
  "id": "INC-1042",
  "type": "BORDER_INTRUSION",
  "severity": "CRITICAL",
  "riskScore": 92,
  "cameraId": "CAM-07",
  "sectorId": "SEC-04",
  "zoneId": "ZONE-RESTRICTED-01",
  "trackId": "P-021",
  "confidence": 0.94,
  "status": "NEW",
  "occurredAt": "2026-09-08T16:00:00Z"
}
```
