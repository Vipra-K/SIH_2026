"use client";

import { useEffect, useRef, useState } from "react";

type Props = { apiBase?: string };
type Job = { job_id?: string; status: string; progress?: number; filename?: string; error?: string };

export default function VideoInput({ apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000" }: Props) {
  const [mode, setMode] = useState<"camera" | "upload">("camera");
  const [camera, setCamera] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Ready");
  const [job, setJob] = useState<Job | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach(t => t.stop()), []);

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
      <video ref={videoRef} muted playsInline className="video-preview" />
      <div className="video-actions"><span className="input-status">● {status}</span>{camera ? <button onClick={stopCamera}>Stop camera</button> : <button onClick={startCamera}>Start camera</button>}</div>
    </> : <>
      {preview ? <img src={preview} className="video-preview" alt="AI annotated surveillance preview" /> : <label className="dropzone"><input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" onChange={e => setFile(e.target.files?.[0] ?? null)} /><strong>{file ? file.name : "Drop surveillance footage here"}</strong><span>MP4, WebM, MOV or AVI · max 500 MB</span></label>}
      <div className="video-actions"><span className="input-status">● {status}{job?.progress != null ? ` · ${job.progress}%` : ""}</span><button disabled={!file || !!job && job.status === "processing"} onClick={upload}>Start analysis</button></div>
      {job?.status === "failed" && <div className="input-error">{job.error || "The AI processing job failed."}</div>}
      {job?.status === "completed" && <div className="input-success">Analysis completed · review the incident feed for generated alerts.</div>}
    </>}
  </div>;
}
