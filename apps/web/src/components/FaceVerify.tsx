import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import { apiFetch } from "../api";
import {
  drawBox,
  drawGroupedLandmarks,
  drawScanLine,
  drawStatusText,
  isAligned,
} from "../lib/faceDraw";

const MODEL_VER = "1.7.15";
const MODEL_BASE = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${MODEL_VER}/model`;
const VIDEO_W = 480;
const VIDEO_H = 360;
const SCAN_INTERVAL_MS = 100;
const AUTO_TRIGGER_THRESHOLD = 0.99;
const AUTO_TRIGGER_FRAMES = 8;

type Phase = "idle" | "loading" | "searching" | "detected" | "aligned" | "working" | "pass" | "fail" | "enrolled";
type Mode = "verify" | "enroll";

type VerifyResult = {
  match: boolean;
  distance: number;
  threshold: number;
  faceHash?: string;
  storedHash?: string;
  hashMatch?: boolean;
  duplicateOfOther?: { kind: string; distance?: number } | null;
};

type EnrollResult = {
  ok: boolean;
  faceCommitmentHash?: string;
  samplesUsed?: number;
  closestExistingUser?: number;
  error?: string;
  distance?: number;
  kind?: string;
};

type Props = {
  onIdentityChanged?: () => void;
};

export function FaceVerify({ onIdentityChanged }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const highConfCount = useRef(0);
  const actionTriggered = useRef(false);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("verify");
  const [phase, setPhase] = useState<Phase>("idle");
  const [modelsReady, setModelsReady] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [enrollResult, setEnrollResult] = useState<EnrollResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startScanner = (m: Mode) => {
    setOpen(true);
    setMode(m);
    setPhase("loading");
    setVerifyResult(null);
    setEnrollResult(null);
    setError(null);
    actionTriggered.current = false;
    highConfCount.current = 0;
  };

  const stopScanner = useCallback(() => {
    clearTimeout(loopRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOpen(false);
    setPhase("idle");
    setConfidence(0);
    actionTriggered.current = false;
    highConfCount.current = 0;
  }, []);

  useEffect(() => {
    if (!open) return;
    let c = false;
    void (async () => {
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_BASE);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE);
        if (!c) { setModelsReady(true); setPhase("searching"); }
      } catch { if (!c) setError("Could not load face models."); }
    })();
    return () => { c = true; };
  }, [open]);

  useEffect(() => {
    if (!open || !modelsReady) return;
    let stopped = false;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: VIDEO_W, height: VIDEO_H, facingMode: "user" }, audio: false,
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) { el.srcObject = stream; await el.play(); }
      } catch { if (!stopped) setError("Camera denied."); }
    })();
    return () => { stopped = true; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  }, [open, modelsReady]);

  const doVerify = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !modelsReady || actionTriggered.current) return;
    actionTriggered.current = true;
    setPhase("working");
    setError(null);
    const ctx = canvas.getContext("2d")!;
    drawStatusText(ctx, canvas, "Verifying…", "#6366f1");
    try {
      const det = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks().withFaceDescriptor();
      if (!det) { setError("No face."); setPhase("searching"); actionTriggered.current = false; return; }
      const arr = Array.from(det.descriptor);
      const res = await apiFetch("/face/verify", { method: "POST", body: JSON.stringify({ embedding: arr }) });
      const j = (await res.json()) as VerifyResult & { error?: string };
      if (!res.ok) { setError(j.error ?? "Verify failed"); setPhase("searching"); actionTriggered.current = false; return; }
      setVerifyResult(j);
      setPhase(j.match ? "pass" : "fail");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setPhase("searching"); actionTriggered.current = false; }
  }, [modelsReady]);

  const doEnroll = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !modelsReady || actionTriggered.current) return;
    actionTriggered.current = true;
    setPhase("working");
    setError(null);
    const ctx = canvas.getContext("2d")!;
    const samples: number[][] = [];
    try {
      for (let s = 0; s < 3; s++) {
        drawStatusText(ctx, canvas, `Sample ${s + 1}/3…`, "#6366f1");
        const det = await faceapi
          .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
          .withFaceLandmarks().withFaceDescriptor();
        if (!det) { setError(`Sample ${s + 1} failed.`); setPhase("searching"); actionTriggered.current = false; return; }
        drawBox(ctx, det.detection.box, "#6366f1");
        drawGroupedLandmarks(ctx, det.landmarks.positions, "#6366f1", Date.now());
        samples.push(Array.from(det.descriptor));
        if (s < 2) await new Promise((r) => setTimeout(r, 400));
      }
      drawStatusText(ctx, canvas, "Checking duplicates…", "#6366f1");
      const res = await apiFetch("/face/enroll", { method: "POST", body: JSON.stringify({ samples }) });
      const j = (await res.json()) as EnrollResult;
      if (!res.ok) {
        const info = j.distance != null ? ` (distance ${j.distance})` : "";
        setError(`${j.error ?? "Enrollment failed"}${info}`);
        setPhase("searching");
        actionTriggered.current = false;
        return;
      }
      setEnrollResult(j);
      setPhase("enrolled");
      onIdentityChanged?.();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setPhase("searching"); actionTriggered.current = false; }
  }, [modelsReady, onIdentityChanged]);

  const doAction = mode === "verify" ? doVerify : doEnroll;

  useEffect(() => {
    if (!open || !modelsReady || phase === "working" || phase === "pass" || phase === "fail" || phase === "enrolled") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    let running = true;

    const tick = async () => {
      if (!running || video.paused) return;
      canvas.width = video.videoWidth || VIDEO_W;
      canvas.height = video.videoHeight || VIDEO_H;
      const t = Date.now();
      const det = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 })).withFaceLandmarks();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!det) { highConfCount.current = 0; setPhase("searching"); setConfidence(0); drawStatusText(ctx, canvas, "Searching…", "#94a3b8"); return; }
      const box = det.detection.box;
      const score = det.detection.score;
      const pct = Math.round(score * 100);
      setConfidence(pct);
      const aligned = isAligned(box, canvas.width, canvas.height, score);
      setPhase(aligned ? "aligned" : "detected");
      const color = aligned ? "#22c55e" : "#f59e0b";
      drawBox(ctx, box, color);
      drawGroupedLandmarks(ctx, det.landmarks.positions, color, t);
      drawScanLine(ctx, box, color, t);
      const autoLabel = score >= AUTO_TRIGGER_THRESHOLD ? (mode === "verify" ? " — auto-verifying…" : " — auto-enrolling…") : "";
      drawStatusText(ctx, canvas, aligned ? `Aligned — ${pct}%${autoLabel}` : `Center face — ${pct}%`, color);
      if (aligned && score >= AUTO_TRIGGER_THRESHOLD) {
        highConfCount.current++;
        if (highConfCount.current >= AUTO_TRIGGER_FRAMES && !actionTriggered.current) { void doAction(); }
      } else { highConfCount.current = Math.max(0, highConfCount.current - 1); }
    };

    const loop = () => { if (!running) return; void tick().finally(() => { if (running) loopRef.current = window.setTimeout(loop, SCAN_INTERVAL_MS); }); };
    loop();
    return () => { running = false; clearTimeout(loopRef.current); };
  }, [open, modelsReady, phase, doAction, mode]);

  if (!open) {
    return (
      <div>
        <div className="row" style={{ gap: "0.5rem" }}>
          <button type="button" className="primary" onClick={() => startScanner("enroll")}>
            Set identity
          </button>
          <button type="button" onClick={() => startScanner("verify")}>
            Test identity
          </button>
        </div>
        {verifyResult && (
          <p style={{ fontSize: "0.85rem", marginTop: "0.5rem", color: verifyResult.match ? "#22c55e" : "#ef4444" }}>
            Last test: {verifyResult.match ? "MATCH" : "NO MATCH"} (distance {verifyResult.distance}, threshold {verifyResult.threshold})
          </p>
        )}
        {enrollResult?.ok && (
          <p style={{ fontSize: "0.85rem", marginTop: "0.5rem", color: "#22c55e" }}>
            Identity set — hash {enrollResult.faceCommitmentHash?.slice(0, 18)}…
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="face-scanner" style={{ marginTop: "0.5rem" }}>
      <p style={{ fontSize: "0.85rem", color: "#6366f1", fontWeight: 600, margin: "0 0 0.5rem" }}>
        {mode === "enroll" ? "Setting identity (3 samples)…" : "Testing identity…"}
      </p>
      <div className="face-video-wrap">
        <video ref={videoRef} autoPlay muted playsInline width={VIDEO_W} height={VIDEO_H} />
        <canvas ref={canvasRef} className="face-overlay" />
        <div className="face-corners" />
      </div>
      <div className="face-status-bar">
        <div className="face-conf-track">
          <div className="face-conf-fill" style={{
            width: `${confidence}%`,
            background: phase === "aligned" ? "#22c55e" : phase === "detected" ? "#f59e0b" : "#94a3b8",
          }} />
        </div>
        <span className="face-conf-label">
          {phase === "loading" && "Loading…"}
          {phase === "searching" && "Looking for face…"}
          {phase === "detected" && `Detected — ${confidence}% — center your face`}
          {phase === "aligned" && `Aligned — ${confidence}% — ${confidence >= 99 ? (mode === "verify" ? "auto-verifying…" : "auto-enrolling…") : "ready"}`}
          {phase === "working" && (mode === "verify" ? "Verifying…" : "Enrolling…")}
          {phase === "pass" && `MATCH — distance ${verifyResult?.distance}`}
          {phase === "fail" && `NO MATCH — distance ${verifyResult?.distance}`}
          {phase === "enrolled" && "Identity set"}
        </span>
      </div>

      {phase === "pass" && verifyResult && (
        <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: "0.85rem", lineHeight: 1.7 }}>
          <strong style={{ color: "#22c55e" }}>Identity verified</strong>
          <span style={{ marginLeft: "0.5rem", color: "#64748b" }}>
            distance {verifyResult.distance} (threshold {verifyResult.threshold}, lower = closer match)
          </span>
          {verifyResult.faceHash && <div><strong>Face hash:</strong> <code style={{ fontSize: "0.72rem", color: "#64748b" }}>{verifyResult.faceHash}</code></div>}
          {verifyResult.hashMatch != null && <div><strong>Hash match:</strong> <span style={{ color: verifyResult.hashMatch ? "#22c55e" : "#f59e0b" }}>{verifyResult.hashMatch ? "Exact" : "Different (normal variation)"}</span></div>}
          {verifyResult.duplicateOfOther && (
            <div style={{ marginTop: "0.25rem", padding: "0.5rem", borderRadius: 6, background: "#fef2f2", border: "1px solid #fecaca" }}>
              <strong style={{ color: "#ef4444" }}>Duplicate</strong> — matches another account ({verifyResult.duplicateOfOther.kind}, dist {verifyResult.duplicateOfOther.distance})
            </div>
          )}
        </div>
      )}

      {phase === "fail" && verifyResult && (
        <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: "0.85rem" }}>
          <strong style={{ color: "#ef4444" }}>Not a match</strong>
          <span style={{ marginLeft: "0.5rem", color: "#64748b" }}>distance {verifyResult.distance} (needed ≤ {verifyResult.threshold})</span>
        </div>
      )}

      {phase === "enrolled" && enrollResult?.ok && (
        <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: "0.85rem" }}>
          <strong style={{ color: "#22c55e" }}>Identity set</strong>
          {enrollResult.faceCommitmentHash && <div><code style={{ fontSize: "0.72rem", color: "#64748b" }}>{enrollResult.faceCommitmentHash}</code></div>}
          <div style={{ color: "#64748b" }}>{enrollResult.samplesUsed} samples averaged{enrollResult.closestExistingUser != null && enrollResult.closestExistingUser > 0 ? ` · closest existing user: distance ${enrollResult.closestExistingUser}` : ""}</div>
        </div>
      )}

      <div className="row" style={{ marginTop: "0.75rem" }}>
        <button type="button" className="primary"
          disabled={phase !== "aligned" && phase !== "detected"}
          onClick={() => void doAction()}>
          {phase === "working" ? (mode === "verify" ? "Verifying…" : "Enrolling…") : mode === "verify" ? "Verify now" : "Enroll now"}
        </button>
        <button type="button" onClick={stopScanner}>Close</button>
      </div>
      {error && <p className="face-msg">{error}</p>}
    </div>
  );
}
