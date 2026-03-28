import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import { apiFetch } from "../api";
import {
  drawBox,
  drawGroupedLandmarks,
  drawScanLine,
  drawStatusText,
  isAligned,
  animateScan,
} from "../lib/faceDraw";

const MODEL_VER = "1.7.15";
const MODEL_BASE = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${MODEL_VER}/model`;
const VIDEO_W = 480;
const VIDEO_H = 360;
const SCAN_INTERVAL_MS = 100;
const AUTO_CAPTURE_THRESHOLD = 0.99;
const AUTO_CAPTURE_FRAMES = 8;

type ScanPhase =
  | "loading"
  | "no-camera"
  | "searching"
  | "detected"
  | "aligned"
  | "capturing"
  | "enrolled"
  | "error";

type Props = { onEnrolled?: () => void; alreadyEnrolled?: boolean };

export function FaceEnrollment({ onEnrolled, alreadyEnrolled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const highConfCount = useRef(0);
  const captureTriggered = useRef(false);

  const [phase, setPhase] = useState<ScanPhase>("loading");
  const [modelsReady, setModelsReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [commitHash, setCommitHash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_BASE);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE);
        if (!cancelled) { setModelsReady(true); setPhase("searching"); }
      } catch (e) {
        if (!cancelled) { setPhase("error"); setMsg(e instanceof Error ? e.message : "Model load failed."); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!modelsReady) return;
    let stopped = false;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: VIDEO_W, height: VIDEO_H, facingMode: "user" },
          audio: false,
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) { el.srcObject = stream; await el.play(); }
      } catch {
        if (!stopped) { setPhase("no-camera"); setMsg("Camera denied."); }
      }
    })();
    return () => { stopped = true; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  }, [modelsReady]);

  const SAMPLE_COUNT = 3;
  const SAMPLE_DELAY_MS = 400;

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !modelsReady || captureTriggered.current) return;
    captureTriggered.current = true;
    setPhase("capturing");
    setMsg(null);
    const ctx = canvas.getContext("2d")!;

    try {
      const samples: number[][] = [];

      for (let s = 0; s < SAMPLE_COUNT; s++) {
        drawStatusText(ctx, canvas, `Capturing sample ${s + 1}/${SAMPLE_COUNT}…`, "#6366f1");
        const det = await faceapi
          .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (!det) {
          setMsg(`Sample ${s + 1} failed — no face. Try again.`);
          setPhase("searching");
          captureTriggered.current = false;
          return;
        }
        drawBox(ctx, det.detection.box, "#6366f1");
        drawGroupedLandmarks(ctx, det.landmarks.positions, "#6366f1", Date.now());
        samples.push(Array.from(det.descriptor));
        if (s < SAMPLE_COUNT - 1) {
          await new Promise((r) => setTimeout(r, SAMPLE_DELAY_MS));
        }
      }

      await animateScan(ctx, { x: 60, y: 40, width: canvas.width - 120, height: canvas.height - 80 }, canvas);

      drawStatusText(ctx, canvas, "Checking for duplicates…", "#6366f1");

      const res = await apiFetch("/face/enroll", {
        method: "POST",
        body: JSON.stringify({ samples }),
      });
      const j = (await res.json()) as {
        error?: string;
        similarity?: number;
        kind?: string;
        faceCommitmentHash?: string;
        samplesUsed?: number;
        topSimilarityToOthers?: number;
      };
      if (!res.ok) {
        const dupInfo = j.similarity != null ? ` (similarity ${j.similarity})` : "";
        const kindInfo = j.kind === "hash" ? " [exact hash match]" : "";
        setMsg(`${j.error ?? "Enrollment failed"}${dupInfo}${kindInfo}`);
        setPhase("searching");
        captureTriggered.current = false;
        return;
      }
      setCommitHash(j.faceCommitmentHash ?? null);
      setPhase("enrolled");
      const extra = j.topSimilarityToOthers != null && j.topSimilarityToOthers > 0
        ? ` (closest existing user: ${j.topSimilarityToOthers} similarity)`
        : "";
      setMsg(`Enrolled with ${j.samplesUsed ?? SAMPLE_COUNT} samples.${extra}`);
      onEnrolled?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      setPhase("searching");
      captureTriggered.current = false;
    }
  }, [modelsReady, onEnrolled]);

  useEffect(() => {
    if (!modelsReady || phase === "capturing" || phase === "enrolled") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    let running = true;

    const tick = async () => {
      if (!running || video.paused || video.ended) return;
      canvas.width = video.videoWidth || VIDEO_W;
      canvas.height = video.videoHeight || VIDEO_H;
      const t = Date.now();

      const det = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
        .withFaceLandmarks();

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!det) {
        highConfCount.current = 0;
        setPhase("searching");
        setConfidence(0);
        drawStatusText(ctx, canvas, "Searching for face…", "#94a3b8");
        return;
      }

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

      const label = aligned
        ? `Aligned — ${pct}%${score >= AUTO_CAPTURE_THRESHOLD ? " — auto-capturing…" : ""}`
        : `Center face — ${pct}%`;
      drawStatusText(ctx, canvas, label, color);

      if (aligned && score >= AUTO_CAPTURE_THRESHOLD) {
        highConfCount.current++;
        if (highConfCount.current >= AUTO_CAPTURE_FRAMES && !captureTriggered.current) {
          void capture();
        }
      } else {
        highConfCount.current = Math.max(0, highConfCount.current - 1);
      }
    };

    const loop = () => {
      if (!running) return;
      void tick().finally(() => { if (running) loopRef.current = window.setTimeout(loop, SCAN_INTERVAL_MS); });
    };
    loop();
    return () => { running = false; clearTimeout(loopRef.current); };
  }, [modelsReady, phase, capture]);

  if (alreadyEnrolled && phase !== "enrolled") {
    return <div className="face-enrolled-badge"><span className="face-check">&#10003;</span> Face enrolled</div>;
  }
  if (phase === "loading") {
    return <div className="face-loader"><div className="face-spinner" /><span>Loading face detection models…</span></div>;
  }
  if (phase === "enrolled") {
    return (
      <div className="face-result">
        <div className="face-check-big">&#10003;</div>
        <p style={{ fontWeight: 600, margin: "0.5rem 0 0.25rem" }}>Face enrolled successfully</p>
        {commitHash && <code className="face-hash">{commitHash}</code>}
      </div>
    );
  }

  return (
    <div className="face-scanner">
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
          {phase === "searching" && "Looking for face…"}
          {phase === "detected" && `Detected — ${confidence}% — center your face`}
          {phase === "aligned" && `Aligned — ${confidence}% — ${confidence >= 99 ? "auto-capturing…" : "ready to capture"}`}
          {phase === "capturing" && "Scanning…"}
          {phase === "no-camera" && "No camera"}
          {phase === "error" && "Error"}
        </span>
      </div>
      <button type="button" className="primary face-capture-btn"
        disabled={phase !== "aligned" && phase !== "detected"}
        onClick={() => void capture()}>
        {phase === "capturing" ? "Scanning…" : "Capture & enroll face"}
      </button>
      {msg && <p className="face-msg">{msg}</p>}
    </div>
  );
}
