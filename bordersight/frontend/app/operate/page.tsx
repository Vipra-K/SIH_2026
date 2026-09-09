use client";

import { useEffect, useRef, useState } from "react";

type CameraDevice = { deviceId: string; label: string };
type CameraState = {
  id: number;
  deviceId: string;
  name: string;
  running: boolean;
  error: string;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const STORAGE_KEY = "bordersight-camera-layout-v1";

export default function Surveillance() {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [cameras, setCameras] = useState<CameraState[]>(() => {
    if (typeof window === "undefined") {
      return [{ id: 1, deviceId: "", name: "CAM-01", running: false, error: "" }];
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (Array.isArray(saved) && saved.length > 0) {
        return saved.map((camera: Partial<CameraState>, index: number) => ({
          id: Number(camera.id) || index + 1,
          deviceId: camera.deviceId ?? "",
          name: camera.name ?? `CAM-${String(index + 1).padStart(2, "0")}`,
          running: false,
          error: "",
        }));
      }
    } catch {
      // Ignore corrupt local state and use defaults.
    }
    return [{ id: 1, deviceId: "", name: "CAM-01", running: false, error: "" }];
  });
  const nextId = useRef(2);

  useEffect(() => {
    const maxId = cameras.reduce((max, camera) => Math.max(max, camera.id), 0);
    nextId.current = maxId + 1;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(cameras.map(({ id, deviceId, name }) => ({ id, deviceId, name })))
      );
    } catch {
      // Local persistence is best-effort.
    }
  }, [cameras]);

  const refreshDevices = async () => {
    try {
      const permission = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      permission.getTracks().forEach(track => track.stop());
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(
        all
          .filter(device => device.kind === "videoinput")
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
          }))
      );
    } catch {
      setDevices([]);
    }
  };

  useEffect(() => {
    refreshDevices();
  }, []);

  const addCamera = () => {
    const id = nextId.current++;
    setCameras(current => [
      ...current,
      { id, deviceId: "", name: `CAM-${String(id).padStart(2, "0")}`, running: false, error: "" },
    ]);
  };

  const removeCamera = (id: number) => {
    setCameras(current => current.filter(camera => camera.id !== id));
  };

  const updateCamera = (id: number, patch: Partial<CameraState>) => {
    setCameras(current => current.map(camera => camera.id === id ? { ...camera, ...patch } : camera));
  };

  return <main className="main surveillance-page">
    <header className="topbar surveillance-header">
      <div>
        <div className="eyebrow">BorderSight / Operations</div>
        <div className="title">Surveillance</div>
        <div className="subtitle">Connect phone cameras and use them as separate live CCTV feeds.</div>
      </div>
      <div className="camera-count">{cameras.length} camera{cameras.length === 1 ? "" : "s"}</div>
    </header>

    <section className="surveillance-toolbar panel">
      <div>
        <div className="panel-title">Camera feeds</div>
        <div className="panel-meta">Each card owns one browser camera stream. Select CAM-01, CAM-02, etc. independently.</div>
      </div>
      <div className="toolbar-actions">
        <button className="secondary-button" onClick={refreshDevices}>Refresh cameras</button>
        <button className="primary-button" onClick={addCamera}>+ Add Camera</button>
      </div>
    </section>

    <section className="camera-grid">
      {cameras.map(camera => (
        <CameraCard
          key={camera.id}
          camera={camera}
          devices={devices}
          api={API}
          onUpdate={patch => updateCamera(camera.id, patch)}
          onRemove={() => removeCamera(camera.id)}
        />
      ))}
    </section>
  </main>;
}

function CameraCard({
  camera,
  devices,
  api,
  onUpdate,
  onRemove,
}: {
  camera: CameraState;
  devices: CameraDevice[];
  api: string;
  onUpdate: (patch: Partial<CameraState>) => void;
  onRemove: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false);

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    onUpdate({ running: false });
  };

  const sendFrame = async () => {
    if (sendingRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || !video.videoWidth) return;

    sendingRef.current = true;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.72));
      if (!blob) return;
      const response = await fetch(`${api}/api/live/${encodeURIComponent(camera.name)}/frame`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      if (!response.ok) throw new Error(`AI endpoint returned ${response.status}`);
      onUpdate({ error: "" });
    } catch (error) {
      onUpdate({ error: error instanceof Error ? error.message : "Could not send camera frame" });
    } finally {
      sendingRef.current = false;
    }
  };

  const start = async () => {
    onUpdate({ error: "" });
    try {
      stop();
      if (!camera.deviceId) {
        throw new Error("Select a camera before starting this feed.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: camera.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      onUpdate({ running: true });
      timerRef.current = setInterval(sendFrame, 700);
    } catch (error) {
      onUpdate({
        running: false,
        error:
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Camera permission was denied."
            : error instanceof Error
              ? error.message
              : "Unable to start camera",
      });
    }
  };

  useEffect(() => () => stop(), []);

  return <article className="camera-card panel">
    <div className="camera-card-head">
      <div>
        <div className="camera-name">{camera.name}</div>
        <div className={`camera-status ${camera.running ? "online" : "offline"}`}><span className="dot" />{camera.running ? "LIVE" : "OFFLINE"}</div>
      </div>
      {camera.id > 1 && <button className="remove-button" onClick={onRemove}>Remove</button>}
    </div>

    <div className="camera-view">
      <video ref={videoRef} muted playsInline autoPlay />
      {!camera.running && <div className="camera-empty">
        <div className="camera-empty-icon">◉</div>
        <strong>Camera not connected</strong>
        <span>Select this card's camera and start the feed.</span>
      </div>}
      <div className="camera-overlay">{camera.running ? "● LIVE · AI INPUT" : "CAMERA READY"}</div>
    </div>
    <canvas ref={canvasRef} style={{ display: "none" }} />

    {camera.error && <div className="camera-error">{camera.error}</div>}

    <div className="camera-controls">
      <select
        value={camera.deviceId}
        disabled={camera.running}
        onChange={event => onUpdate({ deviceId: event.target.value, error: "" })}
      >
        <option value="">Select camera...</option>
        {devices.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
      </select>
      <button className={camera.running ? "stop-button" : "primary-button"} onClick={camera.running ? stop : start}>
        {camera.running ? "Stop" : "Start Camera"}
      </button>
    </div>
  </article>;
}
