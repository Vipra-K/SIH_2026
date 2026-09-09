"use client";

import { useEffect, useRef, useState } from "react";

type Props = { apiBase?: string };
type Job = { job_id?: string; status: string; progress?: number; filename?: string; error?: string };

type CameraDevice = {
  deviceId: string;
  label: string;
};

export default function VideoInput({ apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000" }: Props) {
  const [mode, setMode] = useState<"camera" | "upload">("camera");
  const [camera, setCamera] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Ready");
  const [job, setJob] = useState<Job | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const sendingFrameRef = useRef(false);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (captureTimerRef.current !== null) window.clearInterval(captureTimerRef.current);
  }, []);

  useEffect(() => {
    if (!job?.job_id || job.status === "completed" || job.status === "failed") return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/video/jobs/${job.job_id}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const next = await res.json();
        setJob(next);
        setStatus(next.status === "processing" ? `AI analysis ${next.progress ?? 0}%` : next.status === "queued" ? "Waiting for AI worker…" : next.status);
      } catch { setStatus("Unable to read processing status"); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [apiBase, job?.job_id, job?.status]);

  async function loadCameraDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setStatus("Camera access is not supported by this browser");
      return;
    }

    try {
      // Request permission first so Chrome exposes camera labels such as DroidCam.
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      permissionStream.getTracks().forEach(track => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter(device => device.kind === "videoinput")
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 6)}`,
        }));

      setCameraDevices(cameras);
      if (!selectedCamera && cameras.length > 0) {
        const droidCam = cameras.find(device => /droidcam/i.test(device.label));
        setSelectedCamera(droidCam?.deviceId ?? cameras[0].deviceId);
      }
    } catch {
      setStatus("Camera permission unavailable");
    }
  }

  async function sendFrame() {
    if (sendingFrameRef.current || !videoRef.current || videoRef.current.readyState < 2) return;

    sendingFrameRef.current = true;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      const maxWidth = 1280;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.75));
      if (!blob) return;

      const response = await fetch(`${apiBase}/api/live/CAM-02/frame`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });

      if (!response.ok) throw new Error(`Frame upload failed (${response.status})`);
      setStatus("CAM-02 live · AI detection active");
    } catch {
      setStatus("Camera live · unable to reach BorderSight backend");
    } finally {
      sendingFrameRef.current = false;
    }
  }

  function startFrameCapture() {
    if (captureTimerRef.current !== null) window.clearInterval(captureTimerRef.current);
    // Send one JPEG frame every 500 ms (2 FPS) to keep the demo responsive.
    captureTimerRef.current = window.setInterval(sendFrame, 500);
    void sendFrame();
  }

  async function startCamera() {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (captureTimerRef.current !== null) window.clearInterval(captureTimerRef.current);

      const constraints: MediaStreamConstraints = {
        video: selectedCamera
          ? { deviceId: { exact: selectedCamera }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCamera(true);
      setStatus("Camera live · starting AI detection…");
      startFrameCapture();
    } catch {
      setStatus("Unable to start selected camera");
    }
  }

  function stopCamera() {
    if (captureTimerRef.current !== null) {
      window.clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera(false);
    setStatus("Camera stopped");
  }

  async function upload() {
    if (!file) return;
    const body = new FormData(); body.append("file", file);
    setJob(null); setStatus("Uploading CCTV footage…");
    try {
      const res = await fetch(`${apiBase}/api/video/upload`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setJob(data); setStatus("Queued for AI analysis");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Upload failed"); }
  }

  const preview = job?.job_id && job.status !== "queued" ? `${apiBase}/api/video/jobs/${job.job_id}/mjpeg` : null;

  return <div className="video-input">
    <div className="video-tabs">
      <button className={mode === "camera" ? "selected" : ""} onClick={() => setMode("camera")}>Phone / Webcam</button>
      <button className={mode === "upload" ? "selected" : ""} onClick={() => setMode("upload")}>CCTV Video</button>
    </div>
    {mode === "camera" ? <>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", alignItems: "center" }}>
        <select
          value={selectedCamera}
          onChange={e => setSelectedCamera(e.target.value)}
          disabled={camera}
          aria-label="Camera device"
          style={{ flex: 1 }}
        >
          {cameraDevices.length === 0 ? <option value="">Select camera</option> : cameraDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
          ))}
        </select>
        {!camera && <button onClick={loadCameraDevices}>Refresh cameras</button>}
      </div>
      <video ref={videoRef} muted playsInline className="video-preview" />
      <div className="video-actions"><span className="input-status">● {status}</span>{camera ? <button onClick={stopCamera}>Stop camera</button> : <button onClick={startCamera}>{cameraDevices.length ? "Start camera" : "Detect cameras"}</button>}</div>
    </> : <>
      {preview ? <img src={preview} className="video-preview" alt="AI annotated surveillance preview" /> : <label className="dropzone"><input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" onChange={e => setFile(e.target.files?.[0] ?? null)} /><strong>{file ? file.name : "Drop surveillance footage here"}</strong><span>MP4, WebM, MOV or AVI · max 500 MB</span></label>}
      <div className="video-actions"><span className="input-status">● {status}{job?.progress != null ? ` · ${job.progress}%` : ""}</span><button disabled={!file || !!job && job.status === "processing"} onClick={upload}>Start analysis</button></div>
      {job?.status === "failed" && <div className="input-error">{job.error || "The AI processing job failed."}</div>}
      {job?.status === "completed" && <div className="input-success">Analysis completed · review the incident feed for generated alerts.</div>}
    </>}
  </div>;
}
