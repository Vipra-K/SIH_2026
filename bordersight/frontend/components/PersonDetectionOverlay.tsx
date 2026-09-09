"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

type Detection = {
  track_id: number | null;
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
};

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraId: string;
  running: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const CAPTURE_INTERVAL_MS = 500;

export default function PersonDetectionOverlay({ videoRef, cameraId, running }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureRef = useRef<HTMLCanvasElement | null>(null);
  const detectionsRef = useRef<Detection[]>([]);
  const [personCount, setPersonCount] = useState(0);

  useEffect(() => {
    if (!running) {
      detectionsRef.current = [];
      setPersonCount(0);
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const draw = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const rect = video.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, width, height);

      const sourceWidth = video.videoWidth || width;
      const sourceHeight = video.videoHeight || height;
      const scaleX = width / sourceWidth;
      const scaleY = height / sourceHeight;

      context.lineWidth = 3;
      context.font = "600 14px system-ui, sans-serif";
      detectionsRef.current.forEach((detection) => {
        const [x1, y1, x2, y2] = detection.bbox;
        const x = x1 * scaleX;
        const y = y1 * scaleY;
        const boxWidth = (x2 - x1) * scaleX;
        const boxHeight = (y2 - y1) * scaleY;
        context.strokeStyle = "#22c55e";
        context.strokeRect(x, y, boxWidth, boxHeight);

        const id = detection.track_id == null ? "" : ` #${detection.track_id}`;
        const label = `PERSON${id}  ${(detection.confidence * 100).toFixed(0)}%`;
        const textWidth = context.measureText(label).width + 14;
        const labelY = Math.max(0, y - 25);
        context.fillStyle = "#22c55e";
        context.fillRect(x, labelY, textWidth, 25);
        context.fillStyle = "#07120a";
        context.fillText(label, x + 7, labelY + 17);
      });
    };

    const loop = async () => {
      if (cancelled) return;
      draw();

      const video = videoRef.current;
      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        try {
          if (!captureRef.current) captureRef.current = document.createElement("canvas");
          const capture = captureRef.current;
          capture.width = video.videoWidth;
          capture.height = video.videoHeight;
          const context = capture.getContext("2d");
          if (context) {
            context.drawImage(video, 0, 0, capture.width, capture.height);
            const blob = await new Promise<Blob | null>((resolve) => capture.toBlob(resolve, "image/jpeg", 0.72));
            if (blob && !cancelled) {
              const response = await fetch(`${API_URL}/api/live/${encodeURIComponent(cameraId)}/frame`, {
                method: "POST",
                headers: { "Content-Type": "image/jpeg" },
                body: blob,
              });
              if (response.ok && !cancelled) {
                const data = (await response.json()) as { detections?: Detection[]; person_count?: number };
                const persons = (data.detections ?? []).filter((d) => d.label === "person");
                detectionsRef.current = persons;
                setPersonCount(data.person_count ?? persons.length);
              }
            }
          }
        } catch {
          // Keep the camera preview running if inference is temporarily unavailable.
        }
      }

      if (!cancelled) timer = setTimeout(loop, CAPTURE_INTERVAL_MS);
    };

    loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [cameraId, running, videoRef]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="person-detection-overlay"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 4 }}
      />
      {running && (
        <div
          className={`person-detection-status ${personCount > 0 ? "detected" : "clear"}`}
          style={{ position: "absolute", left: 12, bottom: 12, zIndex: 5, pointerEvents: "none", padding: "7px 10px", borderRadius: 6, background: "rgba(5, 10, 8, 0.82)", color: personCount > 0 ? "#86efac" : "#d1d5db", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em" }}
        >
          <span className="person-status-dot" /> {personCount > 0 ? `${personCount} PERSON${personCount === 1 ? "" : "S"} DETECTED` : "NO PERSON DETECTED"}
        </div>
      )}
    </>
  );
}
