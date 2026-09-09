"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MediaMTXWebRTCReader } from "../../lib/mediamtx-reader";

type CameraSource = { id: string; name: string; type: "device" | "stream"; deviceId?: string; streamName?: string; online: boolean };
type CameraState = { id: number; sourceId: string; name: string; running: boolean; error: string };
type MediaMtxPathsResponse = { items?: Array<{ name: string; online?: boolean; ready?: boolean }> };

const MEDIAMTX_WEBRTC = process.env.NEXT_PUBLIC_MEDIAMTX_WEBRTC_URL ?? "http://127.0.0.1:8889";
const STORAGE_KEY = "bordersight-camera-layout-v3";
const DEFAULT_CAMERA: CameraState = { id: 1, sourceId: "", name: "CAM-01", running: false, error: "" };

export default function Surveillance() {
  const [sources, setSources] = useState<CameraSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [sourceError, setSourceError] = useState("");
  const [cameras, setCameras] = useState<CameraState[]>([DEFAULT_CAMERA]);
  const [hydrated, setHydrated] = useState(false);
  const nextId = useRef(2);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (Array.isArray(saved) && saved.length > 0) {
        setCameras(saved.map((camera: Partial<CameraState>, index: number) => ({ id: Number(camera.id) || index + 1, sourceId: camera.sourceId ?? "", name: camera.name ?? `CAM-${String(index + 1).padStart(2, "0")}`, running: false, error: "" })));
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    nextId.current = cameras.reduce((max, camera) => Math.max(max, camera.id), 0) + 1;
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cameras.map(({ id, sourceId, name }) => ({ id, sourceId, name })))); } catch {}
  }, [cameras, hydrated]);

  const discoverSources = useCallback(async () => {
    setLoadingSources(true); setSourceError("");
    const discovered: CameraSource[] = [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      devices.filter(device => device.kind === "videoinput").forEach((device, index) => discovered.push({ id: `device:${device.deviceId}`, name: device.label || `Camera Device ${index + 1}`, type: "device", deviceId: device.deviceId, online: true }));
    } catch (error) { setSourceError(error instanceof Error ? `Could not discover local cameras: ${error.message}` : "Could not discover local cameras."); }
    try {
      const response = await fetch("/api/mediamtx/streams", { cache: "no-store" });
      if (!response.ok) throw new Error(`Stream discovery returned ${response.status}`);
      const data = (await response.json()) as MediaMtxPathsResponse;
      (data.items ?? []).filter(stream => stream.online !== false && stream.ready !== false).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).forEach(stream => discovered.push({ id: `stream:${stream.name}`, name: `${stream.name} · MediaMTX`, type: "stream", streamName: stream.name, online: true }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not discover MediaMTX streams.";
      setSourceError(current => current ? `${current} ${message}` : message);
    }
    setSources(discovered); setLoadingSources(false);
  }, []);

  useEffect(() => { discoverSources(); }, [discoverSources]);

  const addCamera = () => { const id = nextId.current++; setCameras(current => [...current, { id, sourceId: "", name: `CAM-${String(id).padStart(2, "0")}`, running: false, error: "" }]); };
  const removeCamera = (id: number) => setCameras(current => current.filter(camera => camera.id !== id));
  const updateCamera = (id: number, patch: Partial<CameraState>) => setCameras(current => current.map(camera => camera.id === id ? { ...camera, ...patch } : camera));

  return <main className="main surveillance-page">
    <header className="topbar surveillance-header"><div><div className="eyebrow">BorderSight / Operations</div><div className="title">Surveillance</div><div className="subtitle">Choose from local cameras and MediaMTX network streams.</div></div><div className="camera-count">{cameras.length} camera{cameras.length === 1 ? "" : "s"}</div></header>
    <section className="surveillance-toolbar panel"><div><div className="panel-title">Camera feeds</div><div className="panel-meta">{loadingSources ? "Discovering cameras..." : `${sources.length} camera source${sources.length === 1 ? "" : "s"} available.`}</div>{sourceError && <div className="camera-error">{sourceError}</div>}</div><div className="toolbar-actions"><button className="secondary-button" onClick={discoverSources}>Refresh cameras</button><button className="primary-button" onClick={addCamera}>+ Add Camera</button></div></section>
    <section className="camera-grid">{cameras.map(camera => <CameraCard key={camera.id} camera={camera} sources={sources} onUpdate={patch => updateCamera(camera.id, patch)} onRemove={() => removeCamera(camera.id)} />)}</section>
  </main>;
}

function CameraCard({ camera, sources, onUpdate, onRemove }: { camera: CameraState; sources: CameraSource[]; onUpdate: (patch: Partial<CameraState>) => void; onRemove: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<MediaMTXWebRTCReader | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const destroyPlayback = useCallback(() => {
    readerRef.current?.close(); readerRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop()); localStreamRef.current = null;
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null; videoRef.current.removeAttribute("src"); videoRef.current.load(); }
  }, []);
  const stop = useCallback(() => { destroyPlayback(); onUpdate({ running: false }); }, [destroyPlayback, onUpdate]);

  const start = async () => {
    onUpdate({ error: "" });
    const source = sources.find(item => item.id === camera.sourceId);
    if (!source) { onUpdate({ error: "Select a camera source before starting this feed." }); return; }
    destroyPlayback();
    try {
      const video = videoRef.current;
      if (!video) throw new Error("Video element is not ready.");
      if (source.type === "device") {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: source.deviceId } }, audio: false });
        localStreamRef.current = stream; video.srcObject = stream; await video.play();
      } else {
        const streamUrl = `${MEDIAMTX_WEBRTC}/${encodeURIComponent(source.streamName!)}/whep`;
        const reader = new MediaMTXWebRTCReader({
          url: streamUrl,
          onError: (error: unknown) => onUpdate({ running: false, error: error instanceof Error ? error.message : String(error) }),
          onTrack: (event: RTCTrackEvent) => { video.srcObject = event.streams[0]; video.play().catch(() => {}); onUpdate({ running: true, error: "" }); },
        });
        readerRef.current = reader;
      }
      if (source.type === "device") onUpdate({ running: true, error: "" });
    } catch (error) { destroyPlayback(); onUpdate({ running: false, error: error instanceof Error ? error.message : "Unable to start camera stream" }); }
  };

  useEffect(() => () => destroyPlayback(), [destroyPlayback]);

  return <article className="camera-card panel">
    <div className="camera-card-head"><div><div className="camera-name">{camera.name}</div><div className={`camera-status ${camera.running ? "online" : "offline"}`}><span className="dot" />{camera.running ? "LIVE" : "OFFLINE"}</div></div>{camera.id > 1 && <button className="remove-button" onClick={onRemove}>Remove</button>}</div>
    <div className="camera-view"><video ref={videoRef} muted playsInline autoPlay />{!camera.running && <div className="camera-empty"><div className="camera-empty-icon">◉</div><strong>{camera.sourceId ? "Camera ready" : "No camera selected"}</strong><span>{camera.sourceId ? "Start the selected camera feed." : "Select a local camera, OBS camera, DroidCam, or MediaMTX stream below."}</span></div>}<div className="camera-overlay">{camera.running ? "● LIVE · DIRECT" : "CAMERA READY"}</div></div>
    {camera.error && <div className="camera-error">{camera.error}</div>}
    <div className="camera-controls"><select value={camera.sourceId} disabled={camera.running} onChange={event => { const source = sources.find(item => item.id === event.target.value); onUpdate({ sourceId: event.target.value, name: source ? source.name.replace(" · MediaMTX", "") : camera.name, error: "" }); }}><option value="">Select camera source...</option>{sources.map(source => <option key={source.id} value={source.id}>{source.name}{source.type === "stream" ? " · NETWORK" : " · LOCAL"}</option>)}</select><button className={camera.running ? "stop-button" : "primary-button"} onClick={camera.running ? stop : start}>{camera.running ? "Stop" : "Start Camera"}</button></div>
  </article>;
}
