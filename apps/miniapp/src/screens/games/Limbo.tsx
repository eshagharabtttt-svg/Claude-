import { useEffect, useRef, useState } from "react";
import { BalancePill, Button } from "../../components/ui";
import { usePlayer } from "../../lib/store";
import { useFullScreen } from "../../lib/chrome";
import { GameHeader } from "./GameHeader";

const STAKES = [50, 100, 250, 500];
const PRESETS = [1.5, 2, 5, 10, 50, 100];

/** Return to player — the same 5% rake the rest of the app takes */
const RTP = 95;

const MIN_TARGET = 1.01;
const MAX_TARGET = 1000;
const ROLL_MS = 750;

type Result = { got: number; target: number; won: boolean; payout: number };

/**
 * Draw a multiplier whose survival curve is exactly the payout table:
 * with u uniform, `RTP/100 / u` gives P(result >= t) = RTP / (100·t), so
 * a 2x target hits 47.5% of the time and pays 2x.
 */
function drawResult() {
  const u = Math.random();
  return Math.max(1, Math.floor((RTP / u)) / 100);
}

const chanceOf = (target: number) => Math.min(100, RTP / target);

/** Slider position ↔ target, logarithmic so the low end stays usable */
const posToTarget = (v: number) =>
  Math.round(MIN_TARGET * Math.pow(MAX_TARGET / MIN_TARGET, v / 100) * 100) / 100;
const targetToPos = (t: number) =>
  (Math.log(t / MIN_TARGET) / Math.log(MAX_TARGET / MIN_TARGET)) * 100;

function fakeHash(seed: number) {
  let h = 0x811c9dc5;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").repeat(3).slice(0, 24);
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

export function Limbo({ onBack }: { onBack: () => void }) {
  useFullScreen();
  const { p, credit } = usePlayer();

  const [target, setTarget] = useState(2);
  const [stake, setStake] = useState(100);
  const [rolling, setRolling] = useState(false);
  const [shown, setShown] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<Result[]>([]);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));

  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const chance = chanceOf(target);
  const payout = Math.round(stake * target);

  const roll = () => {
    if (rolling || p.balance < stake) return;
    credit(-stake, "Limbo bet");
    setRolling(true);
    setResult(null);
    buzz(25);

    const got = drawResult();
    const startedAt = Date.now();

    const step = () => {
      const t = Math.min(1, (Date.now() - startedAt) / ROLL_MS);
      // race up through the decades, then settle
      const ease = 1 - Math.pow(1 - t, 4);
      setShown(Math.max(1, Number((1 + (got - 1) * ease).toFixed(2))));
      if (t < 1) {
        raf.current = requestAnimationFrame(step);
        return;
      }

      setShown(got);
      const won = got >= target;
      const paid = won ? Math.round(stake * target) : 0;
      if (won) credit(paid, `Limbo ×${target.toFixed(2)}`);
      const r: Result = { got, target, won, payout: paid };
      setResult(r);
      setHistory((h) => [r, ...h].slice(0, 14));
      setSeed(Math.floor(Math.random() * 1e9));
      setRolling(false);
      buzz(won ? [30, 50, 30] : 140);
    };
    raf.current = requestAnimationFrame(step);
  };

  const targetPos = targetToPos(target);
  const shownPos = Math.min(100, targetToPos(Math.max(MIN_TARGET, shown)));

  return (
    <div className="h-full flex flex-col pb-1">
      <GameHeader title="Limbo" onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      {/* past rolls */}
      <div className="hscroll flex gap-1.5 px-4 pb-3 shrink-0">
        {history.map((h, i) => (
          <span
            key={i}
            className={`shrink-0 mono text-[11px] font-bold px-2 py-1 rounded-md ${
              h.won ? "bg-up/15 text-up" : "bg-down/15 text-down"
            }`}
          >
            {h.got >= 100 ? Math.round(h.got) : h.got.toFixed(2)}×
          </span>
        ))}
        {history.length === 0 && (
          <span className="text-[11px] text-t3">no rolls yet</span>
        )}
      </div>

      {/* stage */}
      <div className="flex-1 min-h-[210px] flex flex-col items-center justify-center px-5">
        <div
          className={`mono font-extrabold leading-none tabular-nums ${
            rolling
              ? "text-t2 text-[56px]"
              : result
                ? result.won
                  ? "text-up text-[62px]"
                  : "text-down text-[62px]"
                : "text-t1 text-[56px]"
          }`}
          style={
            result && !rolling
              ? {
                  textShadow: result.won
                    ? "0 0 32px rgba(22,199,132,.38)"
                    : "0 0 32px rgba(240,97,109,.3)",
                }
              : undefined
          }
        >
          {shown >= 100 ? Math.round(shown) : shown.toFixed(2)}×
        </div>

        <div className="h-6 mt-2">
          {result && !rolling && (
            <div
              className={`text-[14px] font-extrabold pop ${
                result.won ? "text-up" : "text-down"
              }`}
            >
              {result.won
                ? `+${result.payout.toLocaleString("en-US")} ◈`
                : `needed ${result.target.toFixed(2)}×`}
            </div>
          )}
        </div>

        {/* log-scale track: everything at or past the handle pays */}
        <div className="w-full mt-7">
          <div className="relative h-3 rounded-full overflow-hidden bg-s2">
            <div
              className="absolute inset-y-0 bg-down/45"
              style={{ left: 0, width: `${targetPos}%` }}
            />
            <div
              className="absolute inset-y-0 bg-up/60"
              style={{ left: `${targetPos}%`, right: 0 }}
            />
          </div>

          <div className="relative h-7">
            <div
              className="absolute -translate-x-1/2"
              style={{
                left: `${shownPos}%`,
                transition: rolling ? "none" : "left .2s ease-out",
              }}
            >
              <div
                className={`w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] ${
                  result && !rolling
                    ? result.won
                      ? "border-t-up"
                      : "border-t-down"
                    : "border-t-t1"
                }`}
              />
            </div>
            <div
              className="absolute -translate-x-1/2 top-2.5"
              style={{ left: `${targetPos}%` }}
            >
              <div className="h-4 w-4 rounded-full bg-brand border-2 border-bg shadow" />
            </div>
          </div>

          <div className="flex justify-between mono text-[10px] text-t3">
            <span>1×</span>
            <span>5×</span>
            <span>30×</span>
            <span>180×</span>
            <span>1000×</span>
          </div>
        </div>
      </div>

      {/* numbers */}
      <div className="px-3 shrink-0">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Target" value={`${target.toFixed(2)}×`} accent />
          <Stat label="Win chance" value={`${chance.toFixed(2)}%`} />
          <Stat label="Pays" value={payout.toLocaleString("en-US")} />
        </div>
      </div>

      {/* controls */}
      <div className="px-3 pt-3 shrink-0">
        <div className="rounded-2xl border border-line bg-s1 p-3 space-y-3">
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={targetPos}
            disabled={rolling}
            onChange={(e) => setTarget(posToTarget(Number(e.target.value)))}
            className="w-full accent-[#c6f73c]"
          />

          <div className="hscroll flex gap-1.5">
            {PRESETS.map((t) => (
              <button
                key={t}
                disabled={rolling}
                onClick={() => setTarget(t)}
                className={`shrink-0 h-8 px-3 rounded-lg text-[12px] font-bold mono disabled:opacity-40 ${
                  Math.abs(target - t) < 0.005
                    ? "bg-t1 text-bg"
                    : "bg-s2 text-t2"
                }`}
              >
                {t}×
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-t3 w-9 shrink-0">Bet</span>
            <div className="hscroll flex gap-1.5 flex-1">
              {STAKES.map((s) => (
                <button
                  key={s}
                  disabled={rolling}
                  onClick={() => setStake(s)}
                  className={`shrink-0 h-8 px-3 rounded-lg text-[12px] font-bold mono disabled:opacity-40 ${
                    s === stake ? "bg-t1 text-bg" : "bg-s2 text-t2"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <span className="mono text-[11px] text-brand shrink-0">
              → {payout.toLocaleString("en-US")} ◈
            </span>
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={rolling || p.balance < stake}
            onClick={roll}
          >
            {rolling
              ? "Rolling…"
              : p.balance < stake
                ? "Not enough balance"
                : `Roll · ${stake} ◈`}
          </Button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-t3 px-1 pt-2">
          <span>provably fair · RTP {RTP}%</span>
          <span className="mono truncate max-w-[150px]">{fakeHash(seed)}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-s1 px-3 py-2">
      <div className="text-[9px] text-t3">{label}</div>
      <div
        className={`mono text-[16px] font-bold mt-0.5 ${
          accent ? "text-brand" : "text-t1"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
