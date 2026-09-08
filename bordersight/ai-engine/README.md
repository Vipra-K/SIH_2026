# BorderSight Vision Engine

## Inputs

The engine accepts:

- a prerecorded MP4/AVI/MOV file;
- a laptop webcam (`0`);
- a phone camera exposed to the laptop as a webcam (`0` or the OS camera index);
- a future RTSP URL.

## Run

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
python vision_engine.py demo.mp4 --jsonl detections.jsonl
```

For a camera exposed as webcam index 0:

```bash
python vision_engine.py 0
```

The first Ultralytics run downloads the selected YOLO model. For the SIH demo, use a small model such as `yolo11n.pt` for a laptop-friendly prototype. The output is JSON Lines containing frame dimensions, detected classes, confidence, bounding boxes and tracker IDs.

The production integration should feed these detections into `backend/app/vision.py` and then into the incident API.
