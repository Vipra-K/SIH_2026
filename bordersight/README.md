# BorderSight AI

BorderSight is the SIH 2026 prototype for a camera-agnostic border-surveillance intelligence platform. It is designed around the operational loop:

**video source → detection → tracking → virtual border zone → contextual risk → incident → operator response**

The repository currently contains three application parts under `bordersight/`: a Next.js frontend, a FastAPI backend, and a Python/OpenCV/YOLO-compatible AI engine. The current MVP can work with prerecorded video or a local camera, including a phone camera exposed to the laptop as a camera source. fileciteturn2file0

> **Important:** this is an SIH prototype, not a production security system. AI detections are decision support and must be verified by authorized personnel.

## Repository structure

```text
SIH_2026/
└── bordersight/
    ├── frontend/       # Next.js 15 + React 19 UI
    ├── backend/        # FastAPI REST API
    ├── ai-engine/      # Python/OpenCV/Ultralytics vision pipeline
    └── docs/            # Project documentation
```

The frontend uses Next.js, React, TypeScript and `lucide-react`; the backend is FastAPI with Pydantic, OpenCV and Ultralytics-related dependencies. fileciteturn4file0 fileciteturn6file0

## Requirements

Install these before running the project:

- Git
- Node.js 20+ and npm
- Python 3.12 recommended
- A terminal capable of running two or three processes at once
- Optional: a webcam or phone camera for live-camera demos
- Optional: a prerecorded surveillance video for demo mode

The AI engine uses OpenCV, Ultralytics and NumPy, while the backend also requires FastAPI, Uvicorn and multipart support. fileciteturn9file0

## 1. Clone the repository

```bash
git clone https://github.com/Vipra-K/SIH_2026.git
cd SIH_2026/bordersight
```

## 2. Start the backend

Create and activate a virtual environment:

### Windows PowerShell

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### macOS / Linux

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend exposes `/api/health`, `/api/dashboard`, `/api/cameras`, `/api/incidents` and event/incident-management APIs. fileciteturn7file0

Health check:

```text
http://localhost:8000/api/health
```

Interactive API docs:

```text
http://localhost:8000/docs
```

Expected health response:

```json
{
  "status": "ok",
  "service": "bordersight-api",
  "version": "0.4.0"
}
```

## 3. Start the frontend

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

For a production-style local run:

```bash
npm install
npm run build
npm run start
```

The frontend currently defines `dev`, `build` and `start` scripts. fileciteturn4file0

## 4. AI engine

The AI engine lives in `bordersight/ai-engine/` and uses Python, OpenCV, Ultralytics and NumPy. fileciteturn8file0

Set it up with:

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

The engine contains `bordersight_engine.py`, `vision_engine.py` and a `run_demo.py` entry point. Review those files and the AI-engine README for the current detector/demo configuration before starting a live inference session. fileciteturn8file0

## Using a phone as the camera

The architecture is intentionally source-agnostic: demo video, a local camera and future RTSP CCTV feeds are intended to enter the same analytics/incident workflow. fileciteturn10file0

For a phone-camera demo, expose the phone camera to the laptop as a normal webcam using the phone/webcam solution you prefer. Then select the resulting local camera source in BorderSight. No physical CCTV hardware is required for the current MVP.

## Using a prerecorded CCTV video

Use the demo/video flow in the frontend and point the application at a supported local video source. The project is designed to demonstrate the same surveillance loop with prerecorded footage as it does with a live local camera. fileciteturn10file0

## Core demo flow

1. Start the backend and frontend.
2. Open the BorderSight command center.
3. Start a demo surveillance source or local camera.
4. Observe a detected person/object receiving a tracking identity.
5. Configure/use a restricted virtual border zone.
6. Produce an intrusion or loitering condition.
7. BorderSight calculates contextual risk and creates an incident.
8. Open the incident and review the evidence/timeline.
9. Acknowledge the incident, then resolve it after operator verification.

This matches the MVP workflow described in the project documentation. fileciteturn10file0

## Backend API examples

### Health

```bash
curl http://localhost:8000/api/health
```

### Cameras

```bash
curl http://localhost:8000/api/cameras
```

### Incidents

```bash
curl http://localhost:8000/api/incidents
```

### Create a high-risk test event

```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "camera_id": "CAM-01",
    "object_type": "PERSON",
    "track_id": "DEMO-001",
    "confidence": 0.96,
    "crossed_restricted_boundary": true,
    "loiter_seconds": 90,
    "toward_border": true,
    "low_light": true
  }'
```

The API applies a risk threshold before creating an incident and returns the created incident when the event is sufficiently risky. fileciteturn7file0

## Testing

### Backend tests

From `bordersight/backend`:

```bash
pytest -q test_main.py
```

The test suite covers the health endpoint, dashboard response shape, camera/incident endpoints, 404 behavior, event risk-threshold behavior, incident creation and incident status updates.

### Frontend validation

From `bordersight/frontend`:

```bash
npx tsc --noEmit
npm run build
```

## Continuous integration

GitHub Actions runs automatically on pushes and pull requests targeting `main`.

The CI pipeline checks:

- Backend Python compilation
- Backend API tests
- Frontend TypeScript type-checking
- Frontend production build
- Required project files/directories

Workflow file:

```text
bordersight/.github/workflows/ci.yml
```

This means a normal push/PR will catch common regressions before the project is considered healthy.

## Environment variables

The current repository does not require a committed `.env` file for the basic MVP startup described above. Keep secrets out of Git and use local environment files for any future API keys, model credentials or service configuration.

The repository `.gitignore` already ignores `.env`, `.env.*`, Python virtual environments, `node_modules`, Next.js build output and Python cache files. fileciteturn16file0

## Troubleshooting

### `npm install` or `npm run build` fails

Verify Node.js is version 20 or newer, then remove `node_modules` and reinstall:

```bash
rm -rf node_modules .next
npm install
npm run build
```

On Windows, remove the directories manually or use PowerShell's `Remove-Item -Recurse -Force`.

### Backend import/dependency errors

Make sure the backend virtual environment is active and dependencies are installed from `requirements.txt`:

```bash
pip install -r requirements.txt
```

### Port already in use

Run the backend on another port, for example:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Then update the frontend/API configuration wherever the backend URL is consumed.

### Camera not detected

Confirm that the phone/webcam is visible to the operating system first. BorderSight expects the device/source to be available as a supported local camera input; the project is designed to avoid coupling its analytics layer to a specific CCTV vendor or hardware model. fileciteturn10file0

## Current status

BorderSight is an SIH 2026 prototype/MVP. The current repository contains the command-center frontend, FastAPI backend, and AI-engine components needed to demonstrate the surveillance-to-incident workflow. fileciteturn2file0

## Safety and deployment note

Do not treat this prototype as an autonomous enforcement or security decision-maker. Any real deployment should add authentication/authorization, durable persistence, audit logging, secure secrets management, model evaluation, privacy controls, failure handling, monitoring, and formal operational validation.
