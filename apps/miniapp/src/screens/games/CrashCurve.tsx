import { useEffect, useRef } from "react";

/** Same curve the game clock uses — multiplier as a function of flight time */
export function curve(ms: number) {
  return Math.max(1, Math.exp(0.00011 * ms));
}

/** Inverse: how long it takes to reach a multiplier */
function timeAt(mult: number) {
  return Math.log(Math.max(1, mult)) / 0.00011;
}

/** Grid lines at multipliers people actually think in */
const RUNGS = [1.5, 2, 3, 5, 8, 12, 20, 35, 60, 100, 200, 500];

export type CurveMarker = { name: string; at: number };

export function CrashCurve({
  mult,
  crashed,
  idle,
  markers = [],
}: {
  mult: number;
  crashed: boolean;
  idle: boolean;
  markers?: CurveMarker[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = box.current;
    const cv = canvas.current;
    if (!el || !cv) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w === 0 || h === 0) return;

    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;

    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const padR = 44;
    const padB = 18;
    const plotW = w - padR;
    const plotH = h - padB;

    // The view always shows a little more than the current position, so
    // the curve keeps climbing instead of pinning to the top edge.
    const mMax = Math.max(2, mult * 1.25);
    const tMax = Math.max(4000, timeAt(mult) * 1.15);

    const x = (t: number) => (t / tMax) * plotW;
    const y = (m: number) => plotH - ((m - 1) / (mMax - 1)) * plotH;

    const accent = crashed ? "#f0616d" : idle ? "#3a3a40" : "#c6f73c";

    // grid
    ctx.font =
      "600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textBaseline = "middle";
    for (const rung of RUNGS) {
      if (rung > mMax) break;
      const gy = y(rung);
      if (gy < 6 || gy > plotH) continue;
      ctx.strokeStyle = "#17171a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(plotW, gy);
      ctx.stroke();
      ctx.fillStyle = "#3f3f47";
      ctx.fillText(`${rung}×`, plotW + 8, gy);
    }

    // time axis
    ctx.textAlign = "left";
    for (let sec = 0; sec <= tMax / 1000; sec += 5) {
      const gx = x(sec * 1000);
      if (gx > plotW - 14) break;
      ctx.fillStyle = "#3f3f47";
      ctx.fillText(`${sec}s`, gx + 2, plotH + 9);
    }

    if (idle) return;

    // curve
    const path = new Path2D();
    path.moveTo(0, y(1));
    const steps = 120;
    const tNow = timeAt(mult);
    for (let i = 1; i <= steps; i++) {
      const t = (tNow * i) / steps;
      path.lineTo(x(t), y(curve(t)));
    }

    // fill under the curve
    const fill = new Path2D(path);
    fill.lineTo(x(tNow), plotH);
    fill.lineTo(0, plotH);
    fill.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, plotH);
    grad.addColorStop(0, crashed ? "rgba(240,97,109,.38)" : "rgba(198,247,60,.34)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fill(fill);

    // stroke
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
    ctx.stroke(path);
    ctx.shadowBlur = 0;

    // players who already cashed out, pinned where they left
    for (const m of markers) {
      if (m.at > mult) continue;
      const mx = x(timeAt(m.at));
      const my = y(m.at);
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#8a8a93";
      ctx.fill();

      const label = `${m.name} ${m.at.toFixed(2)}×`;
      // flip the label inside when the point is close to the right edge
      const flip = mx + ctx.measureText(label).width + 10 > plotW;
      ctx.textAlign = flip ? "right" : "left";
      ctx.fillStyle = "#6b6b74";
      ctx.fillText(label, mx + (flip ? -6 : 6), my - 8);
    }
    ctx.textAlign = "left";

    // tip
    const tipX = x(tNow);
    const tipY = y(mult);
    ctx.beginPath();
    ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tipX, tipY, 12, 0, Math.PI * 2);
    ctx.fillStyle = crashed ? "rgba(240,97,109,.22)" : "rgba(198,247,60,.22)";
    ctx.fill();
  }, [mult, crashed, idle, markers]);

  return (
    <div ref={box} className="absolute inset-0">
      <canvas ref={canvas} className="block" />
    </div>
  );
}
