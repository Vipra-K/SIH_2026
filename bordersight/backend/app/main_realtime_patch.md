# Realtime integration note

Add the following to the existing FastAPI application startup/imports:

```python
from app.stream_api import router as stream_router
app.include_router(stream_router)
```

The vision worker should call `await publish_detection(frame, camera_id)` for each processed frame. This publishes detection frames and derived incidents through `/api/stream/events` using Server-Sent Events (SSE).

The existing `/api/events` endpoint remains the explicit incident-ingestion contract for clients that prefer REST.
