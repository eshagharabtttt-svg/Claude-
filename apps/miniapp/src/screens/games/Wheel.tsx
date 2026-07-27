import { useEffect, useRef, useState } from "react";
import { BalancePill, Button } from "../../components/ui";
import { usePlayer } from "../../lib/store";
import { useFullScreen } from "../../lib/chrome";
import { GameHeader } from "./GameHeader";

const STAKES = [50, 100, 250, 500];
const SEGMENTS = [10, 20, 30, 40, 50];
const RTP = 0.95;
const SPIN_MS = 3600;

type Risk = "low" | "medium" | "high";

/**
 * Base patterns of ten. Each sums to 9.5, so the wheel returns 95%
 * whatever the risk — the risk setting changes the shape of the payout,
 * never the edge. Longer wheels tile the same ten.
 */
const BASE: Record<Exclude<Risk, "high">, number[]> = {
  low: [0, 1.15, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.15],
  medium: [0, 1.5, 0, 2, 0, 1.5, 1.2, 0, 2, 1.3],
};

/** High risk is one prize and nothing else, sized so the mean still lands on 95% */
function table(risk: Risk, n: number): number[] {
  if (risk === "high") {
    const out = new Array(n).fill(0);
    out[Math.floor(n / 2)] = Math.round(RTP * n * 100) / 100;
    return out;
  }
  const base = BASE[risk];
  return Array.from({ length: n }, (_, i) => base[i % 10]);
}

function colorFor(m: number) {
  if (m === 0) return "#2a2a2e";
  if (m < 1.25) return "#0f766e";
  if (m < 1.75) return "#1d4ed8";
  if (m < 2.5) return "#7c3aed";
  if (m < 6) return "#c026d3";
  return "#c6f73c";
}

function inkFor(m: number) {
  return m >= 6 ? "#0a0a0b" : "#ffffff";
}

function buzz(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

export function Wheel({ onBack }: { onBack: () => void }) {
  useFullScreen();
  const { p, credit } = usePlayer();

  const [risk, setRisk] = useState<Risk>("medium");
  const [count, setCount] = useState(20);
  const [stake, setStake] = useState(100);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [landed, setLanded] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const values = table(risk, count);
  const seg = 360 / count;

  /* ---- draw ---- */
  useEffect(() => {
    const el = box.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const size = Math.min(el.clientWidth, el.clientHeight);
    if (size <= 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * dpr;
    cv.style.width = `${size}px`;
    cv.style.height = `${size}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const rOuter = size / 2 - 4;
    const rInner = rOuter * 0.62;

    ctx.save();
    ctx.translate(cx, cy);
    // 12 o'clock is the pointer, and segments run clockwise from there
    ctx.rotate(((rotation - 90) * Math.PI) / 180);

    values.forEach((m, i) => {
      const a0 = (i * seg * Math.PI) / 180;
      const a1 = ((i + 1) * seg * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(0, 0, rOuter, a0, a1);
      ctx.arc(0, 0, rInner, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = colorFor(m);
      ctx.fill();
      ctx.strokeStyle = "#0a0a0b";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // labels only while there is room for them
      if (count <= 20 && m > 0) {
        ctx.save();
        ctx.rotate((a0 + a1) / 2);
        ctx.translate((rOuter + rInner) / 2, 0);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = inkFor(m);
        ctx.font = `700 ${count <= 10 ? 13 : 10}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${m}×`, 0, 0);
        ctx.restore();
      }
    });
    ctx.restore();

    // hub
    ctx.beginPath();
    ctx.arc(cx, cy, rInner - 3, 0, Math.PI * 2);
    ctx.fillStyle = "#101012";
    ctx.fill();
    ctx.strokeStyle = "#2a2a2e";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [values, rotation, seg, count]);

  /* ---- spin ---- */
  const spin = () => {
    if (spinning || p.balance < stake) return;
    credit(-stake, "Wheel bet");
    setSpinning(true);
    setLanded(null);
    buzz(25);

    const index = Math.floor(Math.random() * count);
    // land the middle of the winning segment under the pointer
    const target =
      360 * 6 + (360 - (index * seg + seg / 2)) - (rotation % 360) + rotation;

    const from = rotation;
    const startedAt = Date.now();

    const step = () => {
      const t = Math.min(1, (Date.now() - startedAt) / SPIN_MS);
      const ease = 1 - Math.pow(1 - t, 4);
      setRotation(from + (target - from) * ease);
      if (t < 1) {
        raf.current = requestAnimationFrame(step);
        return;
      }
      setRotation(target);
      const m = values[index];
      const payout = Math.round(stake * m);
      if (payout > 0) credit(payout, `Wheel ×${m}`);
      setLanded(m);
      setHistory((h) => [m, ...h].slice(0, 14));
      setSpinning(false);
      buzz(m > 0 ? [30, 50, 30] : 140);
    };
    raf.current = requestAnimationFrame(step);
  };

  const distinct = [...new Set(values)].sort((a, b) => a - b);

  return (
    <div className="h-full flex flex-col pb-1">
      <GameHeader title="Wheel" onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      {/* past spins */}
      <div className="hscroll flex gap-1.5 px-4 pb-2 shrink-0">
        {history.map((h, i) => (
          <span
            key={i}
            className="shrink-0 mono text-[11px] font-bold px-2 py-1 rounded-md"
            style={{ background: `${colorFor(h)}33`, color: h === 0 ? "#8a8a93" : colorFor(h) }}
          >
            {h}×
          </span>
        ))}
        {history.length === 0 && (
          <span className="text-[11px] text-t3">no spins yet</span>
        )}
      </div>

      {/* wheel */}
      <div className="flex-1 min-h-[240px] relative flex items-center justify-center px-4">
        <div ref={box} className="relative w-full h-full flex items-center justify-center">
          <canvas ref={canvas} className="block" />

          {/* pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1">
            <div className="w-0 h-0 border-x-[9px] border-x-transparent border-t-[16px] border-t-brand drop-shadow" />
          </div>

          {/* hub readout */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              {landed !== null && !spinning ? (
                <>
                  <div
                    className="mono text-[34px] font-extrabold leading-none pop"
                    style={{ color: landed === 0 ? "#f0616d" : colorFor(landed) }}
                  >
                    {landed}×
                  </div>
                  <div
                    className={`text-[12px] font-bold mt-1 ${
                      landed > 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {landed > 0
                      ? `+${Math.round(stake * landed).toLocaleString("en-US")} ◈`
                      : `−${stake.toLocaleString("en-US")} ◈`}
                  </div>
                </>
              ) : (
                <div className="mono text-[13px] text-t3">
                  {spinning ? "spinning…" : `${count} segments`}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* payout legend */}
      <div className="hscroll flex gap-1.5 px-4 pt-2 shrink-0">
        {distinct.map((m) => (
          <span
            key={m}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-line bg-s1 px-2 py-1"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: colorFor(m) }}
            />
            <span className="mono text-[11px] font-bold">{m}×</span>
            <span className="mono text-[9px] text-t3">
              {Math.round((values.filter((v) => v === m).length / count) * 100)}%
            </span>
          </span>
        ))}
      </div>

      {/* controls */}
      <div className="px-3 pt-3 shrink-0">
        <div className="rounded-2xl border border-line bg-s1 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-t3 w-12 shrink-0">Risk</span>
            <div className="grid grid-cols-3 gap-1.5 flex-1">
              {(["low", "medium", "high"] as Risk[]).map((r) => (
                <button
                  key={r}
                  disabled={spinning}
                  onClick={() => setRisk(r)}
                  className={`h-8 rounded-lg text-[12px] font-bold capitalize disabled:opacity-40 ${
                    risk === r ? "bg-t1 text-bg" : "bg-s2 text-t2"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-t3 w-12 shrink-0">Segments</span>
            <div className="hscroll flex gap-1.5 flex-1">
              {SEGMENTS.map((n) => (
                <button
                  key={n}
                  disabled={spinning}
                  onClick={() => setCount(n)}
                  className={`shrink-0 h-8 px-3 rounded-lg text-[12px] font-bold mono disabled:opacity-40 ${
                    count === n ? "bg-t1 text-bg" : "bg-s2 text-t2"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-t3 w-12 shrink-0">Bet</span>
            <div className="hscroll flex gap-1.5 flex-1">
              {STAKES.map((s) => (
                <button
                  key={s}
                  disabled={spinning}
                  onClick={() => setStake(s)}
                  className={`shrink-0 h-8 px-3 rounded-lg text-[12px] font-bold mono disabled:opacity-40 ${
                    s === stake ? "bg-t1 text-bg" : "bg-s2 text-t2"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={spinning || p.balance < stake}
            onClick={spin}
          >
            {spinning
              ? "Spinning…"
              : p.balance < stake
                ? "Not enough balance"
                : `Spin · ${stake} ◈`}
          </Button>
        </div>

        <div className="text-center text-[10px] text-t3 pt-2">
          RTP {Math.round(RTP * 100)}% on every risk — the shape changes, the
          edge does not
        </div>
      </div>
    </div>
  );
}
