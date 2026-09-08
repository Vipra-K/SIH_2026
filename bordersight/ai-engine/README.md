# BorderSight Vision Engine

## Run against a CCTV recording

```bash
cd bordersight/ai-engine
python -m venv .venv
# Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
python vision_engine.py demo.mp4 --jsonl detections.jsonl
```

## Run against a phone/laptop camera

If the phone is connected to the laptop and exposed as a webcam, use its camera index:

```bash
python vision_engine.py 0
```

Try `1` or `2` if the phone is registered under another camera index.

The engine uses YOLO tracking, draws detections, and writes JSON Lines containing frame dimensions, classes, confidence, bounding boxes and persistent tracker IDs.

The web application can consume these structured events without caring whether the source is a phone camera, laptop webcam, uploaded CCTV recording, or a future RTSP source.

For the SIH prototype, use authorized test footage and treat detections as decision-support signals requiring human verification.
