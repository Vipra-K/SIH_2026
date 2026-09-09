"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, RefObject } from "react";

type Point = [number, number];
type Zone = {
  id: string;
  name: string;
  camera_id: string;
  points: Point[];
  severity: string;
  enabled: boolean;
};

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraId: string;
  running: boolean;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export default function RestrictionZoneOverlay({ videoRef, cameraId, running }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<Point[]>([]);
  const [zoneName, setZoneName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadZones = useCallback(async () => {
    try {
      const response = await fetch(`/api/zones?camera_id=${encodeURIComponent(cameraId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load zones (${response.status})`);
      setZones((await response.json()) as Zone[]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load restriction zones.");
    }
  }, [cameraId]);

  useEffect(() => {
    setDrawing(false);
    setDraft([]);
    setZoneName("");
    loadZones();
  }, [cameraId, loadZones]);

  const getPoint = (event: MouseEvent<HTMLDivElement>): Point | null => {
    const video = videoRef.current;
    if (!video) return null;
    const rect = video.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return [clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height)];
  };

  const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!drawing) return;
    const point = getPoint(event);
    if (!point) return;
    setDraft(current => [...current, point]);
  };

  const cancelDrawing = () => {
    setDrawing(false);
    setDraft([]);
    setZoneName("");
  };

  const saveZone = async () => {
    if (draft.length < 3) { setError("Add at least three points to create a zone."); return; }
    const name = zoneName.trim();
    if (!name) { setError("Give the restricted zone a name before saving."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/zones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, camera_id: cameraId, points: draft, severity: "HIGH", enabled: true }) });
      if (!response.ok) throw new Error(`Could not save zone (${response.status})`);
      const created = (await response.json()) as Zone;
      setZones(current => [...current, created]);
      cancelDrawing();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save restriction zone.");
    } finally { setBusy(false); }
  };

  const deleteZone = async (zoneId: string) => {
    if (!window.confirm("Delete this restriction zone?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/zones/${encodeURIComponent(zoneId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Could not delete zone (${response.status})`);
      setZones(current => current.filter(zone => zone.id !== zoneId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete restriction zone.");
    } finally { setBusy(false); }
  };

  const toggleZone = async (zone: Zone) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/zones/${encodeURIComponent(zone.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !zone.enabled }) });
      if (!response.ok) throw new Error(`Could not update zone (${response.status})`);
      const updated = (await response.json()) as Zone;
      setZones(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update restriction zone.");
    } finally { setBusy(false); }
  };

  const pointsFor = (points: Point[]) => points.map(([x, y]) => `${x * 100},${y * 100}`).join(" ");

  return (
    <div ref={hostRef} className={`restriction-zone-layer ${drawing ? "drawing" : ""}`} onClick={handleCanvasClick}>
      <svg className="restriction-zone-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {zones.filter(zone => zone.enabled).map(zone => (
          <g key={zone.id}>
            <polygon points={pointsFor(zone.points)} className="restriction-zone-polygon" />
            <polyline points={pointsFor([...zone.points, zone.points[0]])} className="restriction-zone-line" />
            <text x={zone.points[0][0] * 100} y={Math.max(4, zone.points[0][1] * 100 - 1.5)} className="restriction-zone-label">{zone.name}</text>
          </g>
        ))}
        {drawing && draft.length > 0 && (
          <>
            <polygon points={pointsFor(draft)} className="restriction-zone-draft" />
            <polyline points={pointsFor(draft)} className="restriction-zone-draft-line" />
            {draft.map(([x, y], index) => <circle key={index} cx={x * 100} cy={y * 100} r="0.8" className="restriction-zone-point" />)}
          </>
        )}
      </svg>

      <div className="restriction-zone-toolbar" onClick={event => event.stopPropagation()}>
        {!drawing ? (
          <button className="zone-tool-button" disabled={!running || busy} onClick={() => { setError(""); setDrawing(true); setDraft([]); setZoneName(""); }}>
            + Create Restricted Zone
          </button>
        ) : (
          <div className="zone-drawing-controls">
            <input value={zoneName} onChange={event => setZoneName(event.target.value)} placeholder="Zone name (e.g. North Gate)" maxLength={80} autoFocus />
            <span className="zone-point-count">{draft.length} points</span>
            <button className="zone-tool-button" disabled={busy || draft.length < 3} onClick={saveZone}>Save Zone</button>
            <button className="zone-cancel-button" disabled={busy} onClick={cancelDrawing}>Cancel</button>
          </div>
        )}
      </div>

      {zones.length > 0 && (
        <div className="restriction-zone-list" onClick={event => event.stopPropagation()}>
          <div className="zone-list-title">Restriction zones</div>
          {zones.map(zone => (
            <div className={`zone-list-item ${zone.enabled ? "" : "disabled"}`} key={zone.id}>
              <span className="zone-list-dot" />
              <span className="zone-list-name">{zone.name}</span>
              <button disabled={busy} onClick={() => toggleZone(zone)}>{zone.enabled ? "Disable" : "Enable"}</button>
              <button disabled={busy} onClick={() => deleteZone(zone.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="restriction-zone-error" onClick={event => event.stopPropagation()}>{error}</div>}
    </div>
  );
}
