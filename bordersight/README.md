# BorderSight AI

BorderSight is the SIH 2026 prototype for a camera-agnostic border-surveillance intelligence platform.

**Operational loop:**

`camera/video → frame ingestion → YOLO detection/tracking → border rules → risk → incident → operator response`

The repository contains three application parts under `bordersight/`:

- `frontend/` — Next.js 15 + React 19 command-center UI
- `backend/` — FastAPI REST API, live-camera ingestion and video processing
- `ai-engine/` — Python/OpenCV/Ultralytics detection and tracking engine

> **Important:** This is an SIH prototype, not a production security system. AI detections are decision-support signals and must be verified by authorized personnel.

## Requirements

- Git
- Node.js 20+ and npm
- Python 3.12 recommended
- A browser with camera permission support (Chrome/Edge recommended)
- Optional phone connected to the laptop as a webcam
- Optional prerecorded surveillance video

## Repository structure

```text
SIH_2026/
├── .github/workflows/ci.yml
└── bordersight/
    ├── frontend/
    ├── backend/
    ├── ai-engine/
    └── docs/
```

## 1. Clone

```bash
git clone https://github.com/Vipra-K/SIH_2026.git
cd SIH_2026/bordersight
```

## 2. Run the backend

### Windows PowerShell

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### macOS / Linux

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Check:

```text
http://localhost:8000/api/health
http://localhost:8000/docs
```

The YOLO model is lazy-loaded only when inference is requested.

## 3. Run the frontend

Open a second terminal:

```bash
cd SIH_2026/bordersight/frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

The frontend defaults to `http://localhost:8000` for the API. If your backend uses another host/port, set `NEXT_PUBLIC_API_URL` before starting the frontend.

## 4. Quick verification before using a camera

Run the backend tests:

```bash
cd SIH_2026/bordersight/backend
pytest -q test_main.py test_live_camera.py
```

Then check the frontend:

```bash
cd SIH_2026/bordersight/frontend
npx tsc --noEmit
npm run build
```

## 5. Use your phone as the live CCTV camera

There are two supported practical setups.

### Recommended SIH demo setup: phone connected to laptop as a webcam

This is the easiest setup when BorderSight is running on the laptop.

1. Connect the phone to the laptop using USB or Wi-Fi.
2. Use a webcam bridge application of your choice so the phone appears to the operating system as a normal webcam.
3. Verify the phone camera appears in the laptop's camera application.
4. Start the BorderSight backend on the laptop.
5. Start the BorderSight frontend on the laptop.
6. Open `http://localhost:3000` in Chrome or Edge.
7. Scroll to **Live surveillance**.
8. Open the camera dropdown.
9. Select the phone camera device.
10. Click **Start live camera**.
11. Allow browser camera permission when prompted.
12. The phone video appears in the surveillance panel.
13. BorderSight captures JPEG frames from the browser camera and sends them to:

```text
POST /api/live/CAM-02/frame
```

14. The backend runs YOLO detection/tracking on each frame.
15. Detection boxes and labels are shown on the live feed.
16. The realtime SSE connection updates the dashboard with detections.
17. Click **Stop live camera** when finished.

The phone itself does not need to run the BorderSight backend. In this setup, the **phone is the camera, the laptop is the processing server, and the browser is the live-camera bridge/UI**.

### Alternative: open BorderSight on the phone itself

A phone browser can also provide its own camera using `getUserMedia`, but the frontend must be served from a secure context and the phone must be able to reach the laptop's backend over the local network. For the SIH demo, the laptop-as-command-center setup above is simpler and more reliable.

## 6. What the live-camera pipeline does

```text
Phone camera
    ↓
Laptop webcam device
    ↓
Browser getUserMedia()
    ↓
JPEG frame every ~700 ms
    ↓
POST /api/live/CAM-02/frame
    ↓
YOLO detection + tracking
    ↓
Realtime SSE
    ↓
BorderSight dashboard
```

The current live endpoint is intentionally lightweight: it performs detection/tracking and publishes realtime detections. The uploaded-video pipeline remains the stronger path for deterministic border-rule/incident demonstrations.

## 7. Use prerecorded CCTV footage

The backend supports uploaded surveillance video through:

```text
POST /api/video/upload
```

Supported formats:

- MP4
- WebM
- MOV
- AVI
- MKV

The MVP upload limit is 500 MB.

After upload, use the returned job ID with:

```text
GET /api/video/jobs/{job_id}
GET /api/video/jobs/{job_id}/mjpeg
```

## 8. Test the incident system

Before the AI camera demo, you can verify the incident API directly at:

```text
http://localhost:8000/docs
```

Use `POST /api/events` with a high-risk event. Example:

```json
{
  "camera_id": "CAM-01",
  "object_type": "PERSON",
  "track_id": "TEST-001",
  "confidence": 0.97,
  "crossed_restricted_boundary": true,
  "loiter_seconds": 90,
  "toward_border": true,
  "low_light": true
}
```

The resulting incident should appear in the command center and can be acknowledged from the UI.

## 9. AI engine

The AI engine is in `bordersight/ai-engine/`.

```bash
cd SIH_2026/bordersight/ai-engine
python3.12 -m venv .venv
```

Activate the environment and install dependencies:

### Windows PowerShell

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### macOS / Linux

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

## 10. GitHub Actions CI

The workflow is located at:

```text
.github/workflows/ci.yml
```

It runs automatically on pushes to `main` and pull requests targeting `main`. It can also be started manually from **GitHub → Actions → BorderSight CI → Run workflow**.

The pipeline checks:

- backend Python compilation
- backend API tests
- live-camera API smoke tests
- AI-engine Python compilation/imports
- frontend TypeScript
- frontend production build
- required project structure

## 11. Current API overview

```text
GET    /api/health
GET    /api/dashboard
GET    /api/cameras
POST   /api/cameras
DELETE /api/cameras/{camera_id}
GET    /api/incidents
GET    /api/incidents/{incident_id}
PATCH  /api/incidents/{incident_id}/status
POST   /api/events
GET    /api/zones
POST   /api/zones
DELETE /api/zones/{zone_id}
POST   /api/live/{camera_id}/frame
POST   /api/video/upload
GET    /api/video/jobs
GET    /api/video/jobs/{job_id}
GET    /api/video/jobs/{job_id}/mjpeg
GET    /api/stream/events
GET    /api/stream/heartbeat
```

Realtime dashboard delivery uses **Server-Sent Events (SSE)**.

## 12. Full SIH checking order

Use this order when preparing the demonstration:

1. Start backend.
2. Open `/api/health`.
3. Open `/docs` and verify the API is reachable.
4. Run `pytest -q test_main.py test_live_camera.py`.
5. Start frontend.
6. Open `http://localhost:3000`.
7. Verify **SYSTEM ONLINE** and **SSE connected**.
8. Test a manual high-risk event through `/docs`.
9. Verify the incident appears in the dashboard.
10. Connect the phone to the laptop as a webcam.
11. Select the phone camera in **Live surveillance**.
12. Click **Start live camera**.
13. Confirm the phone feed is visible.
14. Confirm YOLO detection boxes/tracks appear.
15. Stop the live camera.
16. Upload a prerecorded CCTV video and verify its processing job.
17. Verify the processed MJPEG output.
18. Finally, open GitHub Actions and confirm all CI jobs are green.

## Current MVP limitations

- Live browser-camera ingestion currently publishes detection/tracking results; advanced border-rule evaluation for live frames should be integrated as the next inference milestone.
- Data stores are in-memory and are lost on backend restart.
- Uploaded video jobs are in-memory.
- Authentication/authorization is not a production security layer.
- Durable audit logging is not implemented.
- RTSP/NVR integration is a future production source.

## Safety and deployment

Do not treat BorderSight as an autonomous enforcement or security decision-maker. A real deployment requires authentication and authorization, durable persistence, audit logging, secure secrets management, model evaluation, privacy controls, monitoring, failure handling, operational validation and human oversight.
