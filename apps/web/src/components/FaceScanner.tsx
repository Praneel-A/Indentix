import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import { api } from "../api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";
const LOOP_MS = 90;
const HOLD_FRAMES = 15;

type Mode = "enroll" | "verify";
type Status = "init" | "ready" | "no-face" | "move-closer" | "hold-still" | "scanning" | "done";

interface Props {
  mode: Mode;
  userId?: string;
  onComplete: () => void;
  onClose: () => void;
}

interface Result {
  success: boolean;
  title: string;
  detail: string;
  hash?: string;
}

export function FaceScanner({ mode, userId, onComplete, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const holdCount = useRef(0);
  const fired = useRef(false);

  const [status, setStatus] = useState<Status>("init");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      if (!cancel) setModelsLoaded(true);
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (!modelsLoaded) return;
    let stopped = false;
    void (async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 480 },
            height: { ideal: 640 },
          },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.setAttribute("playsinline", "true");
          v.setAttribute("webkit-playsinline", "true");
          v.muted = true;
          try {
            await v.play();
          } catch {
            /* iOS sometimes needs a user gesture — the play promise may reject */
          }
          setStatus("ready");
        }
      } catch (err) {
        if (!stopped) {
          const msg = err instanceof Error ? err.message : String(err);
          setCameraError(msg.includes("NotAllowed")
            ? "Camera permission denied. Please allow camera access in your browser settings."
            : msg.includes("NotFound")
              ? "No front camera found on this device."
              : `Camera error: ${msg}`);
          setStatus("init");
        }
      }
    })();
    return () => { stopped = true; streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  }, [modelsLoaded]);

  const ENROLL_SAMPLES = 5;

  const doEnroll = useCallback(async (video: HTMLVideoElement) => {
    const samples: number[][] = [];
    for (let i = 0; i < ENROLL_SAMPLES; i++) {
      const d = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks().withFaceDescriptor();
      if (!d) return setResult({ success: false, title: "No face detected", detail: `Failed on sample ${i + 1}. Try again.` });
      samples.push(Array.from(d.descriptor));
      if (i < ENROLL_SAMPLES - 1) await sleep(250);
      setProgress(Math.round(((i + 1) / ENROLL_SAMPLES) * 80));
    }
    setProgress(90);
    const res = await api("/face/enroll", { method: "POST", body: JSON.stringify({ userId, samples }) });
    const j = await res.json() as Record<string, unknown>;
    setProgress(100);
    if (!res.ok) {
      setResult({ success: false, title: "Enrollment blocked", detail: `${j.error ?? "Failed"}${j.distance != null ? ` (distance: ${j.distance})` : ""}` });
    } else {
      setResult({ success: true, title: "Face ID created", detail: `${j.samplesUsed ?? 5} samples captured`, hash: j.faceHash as string | undefined });
      onComplete();
    }
  }, [onComplete, userId]);

  const doVerify = useCallback(async (video: HTMLVideoElement) => {
    setProgress(50);
    const d = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks().withFaceDescriptor();
    if (!d) return setResult({ success: false, title: "No face detected", detail: "Try again." });
    setProgress(80);
    const res = await api("/face/verify", { method: "POST", body: JSON.stringify({ userId, embedding: Array.from(d.descriptor) }) });
    const j = await res.json() as Record<string, unknown>;
    setProgress(100);

    const dist = j.distance as number;
    const thresh = j.threshold as number;
    const verdict = j.verdict as string;

    if (verdict === "PASS") {
      setResult({ success: true, title: "PASS — Identity verified", detail: `Distance: ${dist} ≤ ${thresh} (match)`, hash: j.faceHash as string | undefined });
    } else {
      setResult({ success: false, title: "FAIL — Identity mismatch", detail: res.status === 404 ? (j.error as string) ?? "No face enrolled" : `Distance: ${dist ?? "?"} > ${thresh ?? "0.35"} (too far)` });
    }
  }, [userId]);

  const fire = useCallback(async () => {
    if (fired.current) return;
    fired.current = true;
    setStatus("scanning");
    setProgress(10);
    const video = videoRef.current!;
    if (mode === "enroll") await doEnroll(video);
    else await doVerify(video);
    setStatus("done");
  }, [mode, doEnroll, doVerify]);

  useEffect(() => {
    if (!modelsLoaded || status === "scanning" || status === "done") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    let running = true;

    const tick = async () => {
      if (!running || video.paused || video.ended) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      canvas.width = vw;
      canvas.height = vh;
      ctx.clearRect(0, 0, vw, vh);

      const cx = vw / 2;
      const cy = vh / 2 - vh * 0.03;
      const ovalRx = vw * 0.32;
      const ovalRy = vh * 0.38;

      const det = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
        .withFaceLandmarks();

      if (!det) {
        holdCount.current = 0;
        setStatus("no-face");
        drawOval(ctx, cx, cy, ovalRx, ovalRy, "#94a3b8", true);
        drawMsg(ctx, vw, vh, "Position your face in the oval", "#94a3b8");
        return;
      }

      const box = det.detection.box;
      const faceCx = box.x + box.width / 2;
      const faceCy = box.y + box.height / 2;
      const inOval = Math.abs(faceCx - cx) < ovalRx * 0.55 && Math.abs(faceCy - cy) < ovalRy * 0.45;
      const bigEnough = box.width > vw * 0.18;

      drawLandmarks(ctx, det.landmarks.positions, Date.now());

      if (!bigEnough) {
        holdCount.current = 0;
        setStatus("move-closer");
        drawOval(ctx, cx, cy, ovalRx, ovalRy, "#f59e0b", true);
        drawMsg(ctx, vw, vh, "Move closer", "#f59e0b");
        return;
      }

      if (!inOval) {
        holdCount.current = 0;
        setStatus("ready");
        drawOval(ctx, cx, cy, ovalRx, ovalRy, "#f59e0b", true);
        drawMsg(ctx, vw, vh, "Center your face", "#f59e0b");
        return;
      }

      holdCount.current++;
      const frac = Math.min(holdCount.current / HOLD_FRAMES, 1);
      setProgress(Math.round(frac * 100));

      drawOval(ctx, cx, cy, ovalRx, ovalRy, "#22c55e", false);
      drawOvalArc(ctx, cx, cy, ovalRx, ovalRy, frac);
      drawMsg(ctx, vw, vh, "Hold still…", "#22c55e");

      if (holdCount.current >= HOLD_FRAMES && !fired.current) {
        void fire();
      }
      setStatus("hold-still");
    };

    const loop = () => {
      if (!running) return;
      void tick().finally(() => { if (running) timerRef.current = window.setTimeout(loop, LOOP_MS); });
    };
    loop();
    return () => { running = false; clearTimeout(timerRef.current); };
  }, [modelsLoaded, status, fire]);

  const close = () => {
    clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    onClose();
  };

  if (status === "done" && result) {
    return (
      <div className="clear-result">
        <div className={`clear-icon ${result.success ? "clear-icon-pass" : "clear-icon-fail"}`}>
          {result.success ? "✓" : "✗"}
        </div>
        <h2 className="text-lg font-bold mt-3">{result.title}</h2>
        {result.detail.split("\n").map((line, i) => (
          <p key={i} className="text-sm text-slate-500">{line}</p>
        ))}
        {result.hash && <code className="clear-hash">{result.hash}</code>}
        <div className="flex justify-center mt-4">
          <Button onClick={close}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="clear-scanner">
      {!modelsLoaded && (
        <div className="clear-loading">
          <div className="face-spinner" />
          <span>Loading face models…</span>
        </div>
      )}

      {cameraError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mt-2">
          <p className="font-semibold">Camera error</p>
          <p className="text-xs mt-1">{cameraError}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => { setCameraError(null); setModelsLoaded(false); setTimeout(() => setModelsLoaded(true), 100); }}>Retry</Button>
        </div>
      )}

      <div className="clear-viewport" style={{ display: modelsLoaded && !cameraError ? "block" : "none" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "100%", height: "auto" }}
        />
        <canvas ref={canvasRef} />
      </div>
      {modelsLoaded && !cameraError && (
        <div className="max-w-[400px] mx-auto mt-3 text-center space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-slate-500">
            {status === "init" && "Starting camera…"}
            {status === "ready" && "Position your face in the oval"}
            {status === "no-face" && "No face detected"}
            {status === "move-closer" && "Move closer to the camera"}
            {status === "hold-still" && "Hold still…"}
            {status === "scanning" && (mode === "enroll" ? "Creating identity…" : "Verifying…")}
          </p>
          <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

/* ── drawing ── */

function drawOval(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, dashed: boolean) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  if (dashed) ctx.setLineDash([10, 8]);
  else ctx.setLineDash([]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawOvalArc(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, frac: number) {
  ctx.save();
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLandmarks(ctx: CanvasRenderingContext2D, points: faceapi.Point[], t: number) {
  const pulse = 2 + Math.sin(t / 200);
  const sets: { s: number; e: number; c: string }[] = [
    { s: 0, e: 16, c: "rgba(148,163,184,0.4)" },
    { s: 17, e: 21, c: "rgba(167,139,250,0.6)" },
    { s: 22, e: 26, c: "rgba(167,139,250,0.6)" },
    { s: 27, e: 35, c: "rgba(56,189,248,0.6)" },
    { s: 36, e: 41, c: "rgba(52,211,153,0.7)" },
    { s: 42, e: 47, c: "rgba(52,211,153,0.7)" },
    { s: 48, e: 59, c: "rgba(251,146,60,0.7)" },
    { s: 60, e: 67, c: "rgba(248,113,113,0.7)" },
  ];
  for (const g of sets) {
    ctx.fillStyle = g.c;
    for (let i = g.s; i <= g.e && i < points.length; i++) {
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = g.c;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = g.s; i <= g.e && i < points.length; i++) {
      if (i === g.s) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    if ([36, 42, 48, 60].includes(g.s)) ctx.closePath();
    ctx.stroke();
  }
}

function drawMsg(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, color: string) {
  ctx.save();
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  const m = ctx.measureText(text);
  const pw = 14;
  const bw = m.width + pw * 2;
  const bh = 30;
  const bx = (w - bw) / 2;
  const by = h - 44;
  ctx.fillStyle = "rgba(15,23,42,0.75)";
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 8);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, by + 21);
  ctx.restore();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
