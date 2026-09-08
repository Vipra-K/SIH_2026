"use client";

import { useEffect, useRef, useState } from "react";

type Props = { apiBase?: string };

export default function VideoInput({ apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000" }: Props) {
  const [mode, setMode] = useState<"camera" | "upload">("camera");
  const [camera, setCamera] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Ready");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach(t => t.stop()), []);

  async function startCamera() {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCamera(true); setStatus("Camera live");
    } catch { setStatus("Camera permission unavailable"); }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null; if (videoRef.current) videoRef.current.srcObject = null;
    setCamera(false); setStatus("Camera stopped");
  }

  async function upload() {
    if (!file) return;
    const body = new FormData(); body.append("file", file);
    setStatus("Uploading CCTV footage…");
    try {
      const res = await fetch(`${apiBase}/api/video/upload`, { method: "POST", body });
      if (!res.ok) throw new Error();
      setStatus("Queued for AI analysis");
    } catch { setStatus("Upload endpoint unavailable — frontend demo mode"); }
  }

  return <div className="video-input">
    <div className="video-tabs">
      <button className={mode === "camera" ? "selected" : ""} onClick={() => setMode("camera")}>Phone / Webcam</button>
      <button className={mode === "upload" ? "selected" : ""} onClick={() => setMode("upload")}>CCTV Video</button>
    </div>
    {mode === "camera" ? <>
      <video ref={videoRef} muted playsInline className="video-preview" />
      <div className="video-actions"><span className="input-status">● {status}</span>{camera ? <button onClick={stopCamera}>Stop camera</button> : <button onClick={startCamera}>Start camera</button>}</div>
    </> : <>
      <label className="dropzone"><input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <strong>{file ? file.name : "Drop surveillance footage here"}</strong><span>MP4, WebM, MOV or AVI · processed by the BorderSight AI engine</span>
      </label>
      <div className="video-actions"><span className="input-status">● {status}</span><button disabled={!file} onClick={upload}>Start analysis</button></div>
    </>}
  </div>;
}
