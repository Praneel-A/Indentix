import type { Point } from "@vladmandic/face-api";

/** 68-landmark indices for each facial feature group */
const GROUPS: Record<string, { idx: number[]; closed: boolean; color: string; label: string }> = {
  jaw:       { idx: range(0, 16),   closed: false, color: "#94a3b8", label: "" },
  leftBrow:  { idx: range(17, 21),  closed: false, color: "#a78bfa", label: "L brow" },
  rightBrow: { idx: range(22, 26),  closed: false, color: "#a78bfa", label: "R brow" },
  nose:      { idx: range(27, 35),  closed: false, color: "#38bdf8", label: "Nose" },
  leftEye:   { idx: range(36, 41),  closed: true,  color: "#34d399", label: "L eye" },
  rightEye:  { idx: range(42, 47),  closed: true,  color: "#34d399", label: "R eye" },
  outerMouth:{ idx: range(48, 59),  closed: true,  color: "#fb923c", label: "Mouth" },
  innerMouth:{ idx: range(60, 67),  closed: true,  color: "#f87171", label: "" },
};

function range(a: number, b: number): number[] {
  const r: number[] = [];
  for (let i = a; i <= b; i++) r.push(i);
  return r;
}

export function drawGroupedLandmarks(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  _baseColor: string,
  t: number,
) {
  const pulse = 1 + 0.3 * Math.sin(t / 200);

  for (const g of Object.values(GROUPS)) {
    const pts = g.idx.map((i) => points[i]).filter(Boolean);
    if (pts.length < 2) continue;

    ctx.strokeStyle = g.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    if (g.closed) ctx.closePath();
    ctx.stroke();

    const dotR = 2.2 * pulse;
    for (const p of pts) {
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    if (g.label) {
      const center = pts[Math.floor(pts.length / 2)];
      ctx.font = "500 9px system-ui, sans-serif";
      ctx.fillStyle = g.color;
      ctx.globalAlpha = 0.7;
      ctx.fillText(g.label, center.x + 6, center.y - 6);
      ctx.globalAlpha = 1;
    }
  }
}

export function drawBox(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  const r = 8;
  const { x, y, width: w, height: h } = box;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
}

export function drawScanLine(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  color: string,
  t: number,
) {
  const frac = (t % 1800) / 1800;
  const yLine = box.y + frac * box.height;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.45;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(box.x, yLine);
  ctx.lineTo(box.x + box.width, yLine);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

export function drawStatusText(
  ctx: CanvasRenderingContext2D,
  canvas: { width: number; height: number },
  text: string,
  color: string,
) {
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  const m = ctx.measureText(text);
  const pad = 8;
  const bw = m.width + pad * 2;
  const bh = 24;
  const bx = (canvas.width - bw) / 2;
  const by = canvas.height - 36;
  ctx.fillStyle = "rgba(15,23,42,0.72)";
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 6);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, by + 17);
}

export function isAligned(
  box: { x: number; y: number; width: number; height: number },
  canvasW: number,
  canvasH: number,
  score: number,
): boolean {
  const centered =
    box.x > canvasW * 0.12 &&
    box.x + box.width < canvasW * 0.88 &&
    box.y > canvasH * 0.06 &&
    box.y + box.height < canvasH * 0.94;
  const big = box.width > canvasW * 0.22 && box.height > canvasH * 0.28;
  return centered && big && score > 0.6;
}

export function animateScan(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  canvas: { width: number; height: number },
): Promise<void> {
  return new Promise((resolve) => {
    const steps = 18;
    let i = 0;
    const step = () => {
      if (i >= steps) { resolve(); return; }
      const frac = i / steps;
      const yLine = box.y + frac * box.height;
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(box.x, yLine);
      ctx.lineTo(box.x + box.width, yLine);
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawStatusText(ctx, canvas, `Scanning… ${Math.round(frac * 100)}%`, "#6366f1");
      i++;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
