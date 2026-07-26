import { useEffect, useMemo, useRef, useState } from "react";
import { BalancePill, Button } from "../../components/ui";
import { usePlayer } from "../../lib/store";
import { useFullScreen } from "../../lib/chrome";
import { GameHeader } from "./GameHeader";

const STAKES = [50, 100, 250, 500];
const ROW_OPTIONS = [8, 12, 16];
const RTP = 0.95;
/** Time to cross one row of pegs — slow enough to actually watch the fall */
const HOP_MS = 185;

type Risk = "low" | "medium" | "high";

/** Binomial weight of landing in bucket k after `rows` decisions */
function prob(rows: number, k: number) {
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (rows - i)) / (i + 1);
  return c / Math.pow(2, rows);
}

/** Edge distance, 0 in the middle and 1 at the outermost bucket */
const edge = (rows: number, k: number) => Math.abs(k - rows / 2) / (rows / 2);

const SHAPE: Record<Risk, (d: number) => number> = {
  low: (d) => Math.pow(1 + 2.1 * d, 1.7),
  medium: (d) => Math.pow(1 + 4.5 * d, 2.5),
  high: (d) => Math.pow(1 + 9 * d, 3.8),
};

const round = (v: number) =>
  v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;

/**
 * Payout table for a risk setting.
 *
 * The shape decides how sharply the edges pay; it is then scaled so the
 * expected value is exactly the house RTP. Rounding the numbers to
 * readable ones moves that expectation a little, so the leftover is put
 * back into the centre buckets — the ones the ball reaches most often —
 * and the resulting true RTP is displayed rather than assumed.
 */
function buildTable(rows: number, risk: Risk) {
  const n = rows + 1;
  const shape = Array.from({ length: n }, (_, k) => SHAPE[risk](edge(rows, k)));
  const mean = shape.reduce((a, f, k) => a + f * prob(rows, k), 0);
  const exact = shape.map((f) => (RTP * f) / mean);
  const table = exact.map(round);

  const rtpOf = (t: number[]) => t.reduce((a, m, k) => a + m * prob(rows, k), 0);
  const mid = rows / 2;
  const centres =
    rows % 2 === 0 ? [mid] : [Math.floor(mid), Math.ceil(mid)];
  const residual = RTP - rtpOf(table);
  const mass = centres.reduce((a, k) => a + prob(rows, k), 0);
  for (const k of centres) table[k] = round(table[k] + residual / mass);

  return { table, rtp: rtpOf(table) };
}

function colorFor(m: number) {
  if (m >= 50) return "#c6f73c";
  if (m >= 10) return "#f0616d";
  if (m >= 3) return "#f97316";
  if (m >= 1.5) return "#f5a524";
  if (m >= 1) return "#16c784";
  return "#3f6d5a";
}

type Ball = {
  id: number;
  path: number[]; // index at each row
  startedAt: number;
  stake: number;
};

function buzz(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

export function Plinko({ onBack }: { onBack: () => void }) {
  useFullScreen();
  const { p, credit } = usePlayer();

  const [risk, setRisk] = useState<Risk>("medium");
  const [rows, setRows] = useState(12);
  const [stake, setStake] = useState(100);
  const [history, setHistory] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(null);

  const { table, rtp } = useMemo(() => buildTable(rows, risk), [rows, risk]);

  const balls = useRef<Ball[]>([]);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const tableRef = useRef(table);
  tableRef.current = table;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  /* ---- render loop ---- */
  useEffect(() => {
    const el = box.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let stop = false;

    const frame = () => {
      if (stop) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (cv.width !== w * dpr || cv.height !== h * dpr) {
          cv.width = w * dpr;
          cv.height = h * dpr;
          cv.style.width = `${w}px`;
          cv.style.height = `${h}px`;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const R = rowsRef.current;
        const padY = 14;
        const rowH = (h - padY * 2) / (R + 1);
        const spacing = Math.min(rowH * 1.25, (w - 26) / (R + 1));
        const cx = w / 2;
        const pegX = (i: number, j: number) => cx + (j - i / 2) * spacing;
        const pegY = (i: number) => padY + i * rowH;

        // pegs
        ctx.fillStyle = "#3a3a42";
        for (let i = 1; i <= R; i++) {
          for (let j = 0; j <= i; j++) {
            ctx.beginPath();
            ctx.arc(pegX(i, j), pegY(i), Math.max(1.8, spacing * 0.09), 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // balls
        const now = Date.now();
        const done: Ball[] = [];
        for (const b of balls.current) {
          const t = (now - b.startedAt) / HOP_MS;
          const step = Math.floor(t);
          if (step >= R) {
            done.push(b);
            continue;
          }
          const f = t - step;
          const jFrom = b.path[step];
          const jTo = b.path[step + 1];
          const x0 = pegX(step, jFrom);
          const x1 = pegX(step + 1, jTo);
          const y0 = pegY(step);
          const y1 = pegY(step + 1);
          const x = x0 + (x1 - x0) * f;
          // a small hop between pegs instead of a straight slide
          const y = y0 + (y1 - y0) * f - Math.sin(f * Math.PI) * rowH * 0.28;

          ctx.beginPath();
          ctx.arc(x, y, Math.max(3.5, spacing * 0.22), 0, Math.PI * 2);
          ctx.fillStyle = "#c6f73c";
          ctx.shadowColor = "#c6f73c";
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        for (const b of done) {
          balls.current = balls.current.filter((x) => x.id !== b.id);
          const k = b.path[R];
          const m = tableRef.current[k];
          const payout = Math.round(b.stake * m);
          if (payout > 0) credit(payout, `Plinko ×${m}`);
          setHistory((hh) => [m, ...hh].slice(0, 14));
          setFlash(k);
          setTimeout(() => setFlash((cur) => (cur === k ? null : cur)), 500);
          buzz(m >= 1 ? [25, 40, 25] : 90);
        }
      }
      raf.current = requestAnimationFrame(frame);
    };

    raf.current = requestAnimationFrame(frame);
    return () => {
      stop = true;
      cancelAnimationFrame(raf.current);
    };
  }, [credit]);

  const drop = () => {
    if (p.balance < stake) return;
    credit(-stake, "Plinko drop");
    // each peg is an independent coin flip, which is what makes the
    // landing distribution binomial and the table honest
    const path = [0];
    for (let i = 0; i < rows; i++) {
      path.push(path[i] + (Math.random() < 0.5 ? 0 : 1));
    }
    balls.current.push({
      id: ++seq.current,
      path,
      startedAt: Date.now(),
      stake,
    });
    buzz(18);
  };

  return (
    <div className="h-full flex flex-col pb-1">
      <GameHeader title="Plinko" onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      {/* past drops */}
      <div className="hscroll flex gap-1.5 px-4 pb-1 shrink-0">
        {history.map((h, i) => (
          <span
            key={i}
            className="shrink-0 mono text-[11px] font-bold px-2 py-1 rounded-md"
            style={{ background: `${colorFor(h)}26`, color: colorFor(h) }}
          >
            {h}×
          </span>
        ))}
        {history.length === 0 && (
          <span className="text-[11px] text-t3">no drops yet</span>
        )}
      </div>

      {/* board */}
      <div ref={box} className="flex-1 min-h-[240px] relative">
        <canvas ref={canvas} className="block" />
      </div>

      {/* buckets */}
      <div className="px-2 shrink-0">
        <div className="flex gap-[2px]">
          {table.map((m, k) => (
            <div
              key={k}
              className="flex-1 rounded-[4px] text-center py-1 transition-transform"
              style={{
                background: `${colorFor(m)}${flash === k ? "" : "33"}`,
                color: flash === k ? "#0a0a0b" : colorFor(m),
                transform: flash === k ? "translateY(3px)" : "none",
              }}
            >
              <span
                className="mono font-bold"
                style={{ fontSize: rows > 12 ? 7 : rows > 8 ? 8.5 : 10 }}
              >
                {m}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* controls */}
      <div className="px-3 pt-3 shrink-0">
        <div className="rounded-2xl border border-line bg-s1 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-t3 w-10 shrink-0">Risk</span>
            <div className="grid grid-cols-3 gap-1.5 flex-1">
              {(["low", "medium", "high"] as Risk[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRisk(r)}
                  className={`h-8 rounded-lg text-[12px] font-bold capitalize ${
                    risk === r ? "bg-t1 text-bg" : "bg-s2 text-t2"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-t3 w-10 shrink-0">Rows</span>
            <div className="grid grid-cols-3 gap-1.5 flex-1">
              {ROW_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setRows(n)}
                  className={`h-8 rounded-lg text-[12px] font-bold mono ${
                    rows === n ? "bg-t1 text-bg" : "bg-s2 text-t2"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-t3 w-10 shrink-0">Bet</span>
            <div className="hscroll flex gap-1.5 flex-1">
              {STAKES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStake(s)}
                  className={`shrink-0 h-8 px-3 rounded-lg text-[12px] font-bold mono ${
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
            disabled={p.balance < stake}
            onClick={drop}
          >
            {p.balance < stake ? "Not enough balance" : `Drop · ${stake} ◈`}
          </Button>
        </div>

        <div className="text-center text-[10px] text-t3 pt-2">
          Drop as many as you like — RTP {(rtp * 100).toFixed(1)}% on this table
        </div>
      </div>
    </div>
  );
}
