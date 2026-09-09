"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type CameraStream = {
  name: string;
  online: boolean;
  ready: boolean;
  tracks?: string[];
};

type CameraState = {
  id: number;
  streamName: string;
  name: string;
  running: boolean;
  error: string;
};

type MediaMtxPathsResponse = {
  items?: Array<{
    name: string;
    online?: boolean;
    ready?: boolean;
    available?: boolean;
    tracks?: string[];
  }>;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MEDIAMTX_API = process.env.NEXT_PUBLIC_MEDIAMTX_API_URL ?? "http://127.0.0.1:9997";
const MEDIAMTX_HLS = process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL ?? "http://127.0.0.1:8888";
const STORAGE_KEY = "bordersight-camera-layout-v2";

export default function Surveillance() {
  const [streams, setStreams] = useState<CameraStream[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [streamError, setStreamError] = useState("");
  const [cameras, setCameras] = useState<CameraState[]>(() => {
    if (typeof window === "undefined") {
      return [{ id: 1, streamName: "", name: "CAM-01", running: false, error: "" }];
    }

    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (Array.isArray(saved) && saved.length > 0) {
        return saved.map((camera: Partial<CameraState>, index: number) => ({
          id: Number(camera.id) || index + 1,
          streamName: camera.streamName ?? "",
          name: camera.name ?? `CAM-${String(index + 1).padStart(2, "0")}`,
          running: false,
          error: "",
        }));
      }
    } catch {
      // Ignore corrupt local state and use defaults.
    }

    return [{ id: 1, streamName: "", name: "CAM-01", running: false, error: "" }];
  });

  const nextId = useRef(2);

  useEffect(() => {
    const maxId = cameras.reduce((max, camera) => Math.max(max, camera.id), 0);
    nextId.current = maxId + 1;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(cameras.map(({ id, streamName, name }) => ({ id, streamName, name })))
      );
    } catch {
      // Local persistence is best-effort.
    }
  }, [cameras]);

  const refreshStreams = useCallback(async () => {
    setLoadingStreams(true);
    try {
      const response = await fetch(`${MEDIAMTX_API}/v3/paths/list`, { cache: "no-store" });
      if (!response.ok) throw new Error(`MediaMTX returned ${response.status}`);

      const data = (await response.json()) as MediaMtxPathsResponse;
      const activeStreams = (data.items ?? [])
        .filter(stream => stream.online !== false && stream.ready !== false)
        .map(stream => ({
          name: stream.name,
          online: stream.online !== false,
          ready: stream.ready !== false,
          tracks: stream.tracks,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      setStreams(activeStreams);
      setStreamError("");
    } catch (error) {
      setStreamError(
        error instanceof Error
          ? `Could not discover MediaMTX streams: ${error.message}`
          : "Could not discover MediaMTX streams."
      );
    } finally {
      setLoadingStreams(false);
    }
  }, []);

  useEffect(() => {
    refreshStreams();
    const interval = setInterval(refreshStreams, 5000);
    return () => clearInterval(interval);
  }, [refreshStreams]);

  const addCamera = () => {
    const id = nextId.current++;
    setCameras(current => [
      ...current,
      { id, streamName: "", name: `CAM-${String(id).padStart(2, "0")}`, running: false, error: "" },
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
        <div className="subtitle">Discover active MediaMTX camera streams and assign them to separate CCTV feeds.</div>
      </div>
      <div className="camera-count">{cameras.length} camera{cameras.length === 1 ? "" : "s"}</div>
    </header>

    <section className="surveillance-toolbar panel">
      <div>
        <div className="panel-title">Camera feeds</div>
        <div className="panel-meta">
          {loadingStreams ? "Discovering live streams..." : `${streams.length} live stream${streams.length === 1 ? "" : "s"} discovered from MediaMTX.`}
        </div>
        {streamError && <div className="camera-error">{streamError}</div>}
      </div>
      <div className="toolbar-actions">
        <button className="secondary-button" onClick={refreshStreams}>Refresh streams</button>
        <button className="primary-button" onClick={addCamera}>+ Add Camera</button>
      </div>
    </section>

    <section className="camera-grid">
      {cameras.map(camera => (
        <CameraCard
          key={camera.id}
          camera={camera}
          streams={streams}
          api={API}
          hlsBaseUrl={MEDIAMTX_HLS}
          onUpdate={patch => updateCamera(camera.id, patch)}
          onRemove={() => removeCamera(camera.id)}
        />
      ))}
    </section>
  </main>;
}

function CameraCard({
  camera,
  streams,
  api,
  hlsBaseUrl,
  onUpdate,
  onRemove,
}: {
  camera: CameraState;
  streams: CameraStream[];
  api: string;
  hlsBaseUrl: string;
  onUpdate: (patch: Partial<CameraState>) => void;
  onRemove: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false);

  const destroyPlayback = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, []);

  const stop = useCallback(() => {
    destroyPlayback();
    onUpdate({ running: false });
  }, [destroyPlayback, onUpdate]);

  const sendFrame = useCallback(async () => {
    if (sendingRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2 || !video.videoWidth) return;

    sendingRef.current = true;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, "image/jpeg", 0.72)
      );
      if (!blob) return;

      const response = await fetch(`${api}/api/live/${encodeURIComponent(camera.name)}/frame`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });

      if (!response.ok) throw new Error(`AI endpoint returned ${response.status}`);
      onUpdate({ error: "" });
    } catch (error) {
      onUpdate({
        error: error instanceof Error ? error.message : "Could not send camera frame",
      });
    } finally {
      sendingRef.current = false;
    }
  }, [api, camera.name, onUpdate]);

  const start = async () => {
    onUpdate({ error: "" });

    if (!camera.streamName) {
      onUpdate({ error: "Select an available stream before starting this feed." });
      return;
    }

    const streamExists = streams.some(stream => stream.name === camera.streamName && stream.online);
    if (!streamExists) {
      onUpdate({ error: "That stream is no longer online. Refresh streams and select an active stream." });
      return;
    }

    destroyPlayback();

    try {
      const video = videoRef.current;
      if (!video) throw new Error("Video element is not ready.");

      const hlsUrl = `${hlsBaseUrl}/${camera.streamName}/index.m3u8`;

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
        await video.play();
      } else if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 2,
        });
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);

        await new Promise<void>((resolve, reject) => {
          const onManifest = () => {
            hls.off(Hls.Events.MANIFEST_PARSED, onManifest);
            hls.off(Hls.Events.ERROR, onError);
            resolve();
          };
          const onError = (_event: string, data: { fatal?: boolean }) => {
            if (data.fatal) {
              hls.off(Hls.Events.MANIFEST_PARSED, onManifest);
              hls.off(Hls.Events.ERROR, onError);
              reject(new Error("Unable to load the selected MediaMTX stream."));
            }
          };
          hls.on(Hls.Events.MANIFEST_PARSED, onManifest);
          hls.on(Hls.Events.ERROR, onError);
        });

        await video.play();
      } else {
        throw new Error("This browser does not support HLS playback.");
      }

      onUpdate({ running: true, error: "" });
      timerRef.current = setInterval(sendFrame, 700);
    } catch (error) {
      destroyPlayback();
      onUpdate({
        running: false,
        error: error instanceof Error ? error.message : "Unable to start camera stream",
      });
    }
  };

  useEffect(() => () => destroyPlayback(), [destroyPlayback]);

  return <article className="camera-card panel">
    <div className="camera-card-head">
      <div>
        <div className="camera-name">{camera.name}</div>
        <div className={`camera-status ${camera.running ? "online" : "offline"}`}>
          <span className="dot" />{camera.running ? "LIVE" : "OFFLINE"}
        </div>
      </div>
      {camera.id > 1 && <button className="remove-button" onClick={onRemove}>Remove</button>}
    </div>

    <div className="camera-view">
      <video ref={videoRef} muted playsInline autoPlay />
      {!camera.running && <div className="camera-empty">
        <div className="camera-empty-icon">◉</div>
        <strong>{camera.streamName ? "Stream ready" : "No stream selected"}</strong>
        <span>{camera.streamName ? `Select ${camera.streamName} and start the feed.` : "Select an available MediaMTX stream below."}</span>
      </div>}
      <div className="camera-overlay">{camera.running ? "● LIVE · AI INPUT" : "CAMERA READY"}</div>
    </div>
    <canvas ref={canvasRef} style={{ display: "none" }} />

    {camera.error && <div className="camera-error">{camera.error}</div>}

    <div className="camera-controls">
      <select
        value={camera.streamName}
        disabled={camera.running}
        onChange={event => onUpdate({ streamName: event.target.value, error: "" })}
      >
        <option value="">Select live stream...</option>
        {streams.map(stream => (
          <option key={stream.name} value={stream.name}>
            {stream.name} · LIVE
          </option>
        ))}
      </select>
      <button className={camera.running ? "stop-button" : "primary-button"} onClick={camera.running ? stop : start}>
        {camera.running ? "Stop" : "Start Camera"}
      </button>
    </div>
  </article>;
}
