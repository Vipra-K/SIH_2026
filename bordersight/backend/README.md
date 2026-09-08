# BorderSight backend

FastAPI service contract for cameras, sectors, zones, incidents and risk scoring.

The initial implementation uses an in-memory store so the Phase-2 demo can run without external infrastructure. Persistence can be swapped to SQLite/PostgreSQL behind the same service layer.
