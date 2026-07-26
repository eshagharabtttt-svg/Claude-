import { useEffect, useRef, useState } from "react";
import { BalancePill, Button } from "../../components/ui";
import { usePlayer } from "../../lib/store";
import { useFullScreen } from "../../lib/chrome";
import { GameHeader } from "./GameHeader";

const STAKES = [50, 100, 250, 500];

/** Return to player. The other 5% is the same rake the pools take. */
const RTP = 95;

const MIN_TARGET = 2;
const MAX_TARGET = 98;

const ROLL_MS = 900;

type Mode = "under" | "over";
type Result = { roll: number; won: boolean; payout: number };

/** Win chance in percent for a target and direction */
function chanceOf(target: number, mode: Mode) {
  return mode === "under" ? target : 100 - target;
}

/** Fair multiplier: stake back plus the edge-adjusted odds */
function multOf(target: number, mode: Mode) {
  return RTP / chanceOf(target, mode);
}

/**
 * Stand-in for the server's commit hash. A real build draws the roll
 * server-side, publishes its hash before the bet and reveals the seed
 * after — the client must never be the one holding the number.
 */
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

export function Dice({ onBack }: { onBack: () => void }) {
  useFullScreen();
  const { p, credit } = usePlayer();

  const [target, setTarget] = useState(50);
  const [mode, setMode] = useState<Mode>("under");
  const [stake, setStake] = useState(100);
  const [rolling, setRolling] = useState(false);
  const [shown, setShown] = useState(50);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<Result[]>([]);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));

  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const chance = chanceOf(target, mode);
  const mult = multOf(target, mode);
  const payout = Math.round(stake * mult);

  const roll = () => {
    if (rolling || p.balance < stake) return;
    credit(-stake, "Dice bet");
    setRolling(true);
    setResult(null);
    buzz(25);

    const landed = Math.round(Math.random() * 9999) / 100;
    const startedAt = Date.now();
    const from = shown;

    const step = () => {
      const t = Math.min(1, (Date.now() - startedAt) / ROLL_MS);
      // fast scatter that settles onto the landing number
      if (t < 0.75) {
        const jitter = Math.random() * 100;
        setShown(Number((from * (1 - t) + jitter * t).toFixed(2)));
        raf.current = requestAnimationFrame(step);
        return;
      }
      const ease = (t - 0.75) / 0.25;
      setShown(
        Number((shownLerp(from, landed, ease) + (1 - ease) * 0).toFixed(2))
      );
      if (t < 1) {
        raf.current = requestAnimationFrame(step);
        return;
      }

      setShown(landed);
      const won = mode === "under" ? landed < target : landed > target;
      const paid = won ? Math.round(stake * mult) : 0;
      if (won) credit(paid, `Dice ×${mult.toFixed(2)}`);
      const r: Result = { roll: landed, won, payout: paid };
      setResult(r);
      setHistory((h) => [r, ...h].slice(0, 14));
      setSeed(Math.floor(Math.random() * 1e9));
      setRolling(false);
      buzz(won ? [30, 50, 30] : 140);
    };
    raf.current = requestAnimationFrame(step);
  };

  const winLeft = mode === "under";
  const markerPct = Math.min(100, Math.max(0, shown));

  return (
    <div className="h-full flex flex-col pb-1">
      <GameHeader title="Dice" onBack={onBack}>
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
            {h.roll.toFixed(2)}
          </span>
        ))}
        {history.length === 0 && (
          <span className="text-[11px] text-t3">no rolls yet</span>
        )}
      </div>

      {/* stage */}
      <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center px-5">
        <div
          className={`mono font-extrabold leading-none tabular-nums ${
            rolling
              ? "text-t2 text-[58px]"
              : result
                ? result.won
                  ? "text-up text-[64px]"
                  : "text-down text-[64px]"
                : "text-t1 text-[58px]"
          }`}
          style={
            result && !rolling
              ? {
                  textShadow: result.won
                    ? "0 0 30px rgba(22,199,132,.35)"
                    : "0 0 30px rgba(240,97,109,.3)",
                }
              : undefined
          }
        >
          {shown.toFixed(2)}
        </div>

        {result && !rolling && (
          <div
            className={`mt-2 text-[14px] font-extrabold pop ${
              result.won ? "text-up" : "text-down"
            }`}
          >
            {result.won
              ? `+${result.payout.toLocaleString("en-US")} ◈`
              : `−${stake.toLocaleString("en-US")} ◈`}
          </div>
        )}

        {/* track */}
        <div className="w-full mt-9">
          <div className="relative h-3 rounded-full overflow-hidden bg-s2">
            <div
              className="absolute inset-y-0 bg-up/70"
              style={
                winLeft
                  ? { left: 0, width: `${target}%` }
                  : { left: `${target}%`, right: 0 }
              }
            />
            <div
              className="absolute inset-y-0 bg-down/50"
              style={
                winLeft
                  ? { left: `${target}%`, right: 0 }
                  : { left: 0, width: `${target}%` }
              }
            />
          </div>

          {/* marker */}
          <div className="relative h-6">
            <div
              className="absolute -translate-x-1/2 flex flex-col items-center"
              style={{
                left: `${markerPct}%`,
                transition: rolling ? "none" : "left .18s ease-out",
              }}
            >
              <div
                className={`w-0 h-0 border-x-[6px] border-x-transparent border-b-[8px] ${
                  result && !rolling
                    ? result.won
                      ? "border-b-up"
                      : "border-b-down"
                    : "border-b-t1"
                }`}
                style={{ transform: "rotate(180deg)" }}
              />
            </div>

            {/* target handle */}
            <div
              className="absolute -translate-x-1/2 top-2"
              style={{ left: `${target}%` }}
            >
              <div className="h-4 w-4 rounded-full bg-brand border-2 border-bg shadow" />
            </div>
          </div>

          <div className="flex justify-between mono text-[10px] text-t3 mt-1">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>
      </div>

      {/* numbers */}
      <div className="px-3 shrink-0">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Multiplier" value={`${mult.toFixed(2)}×`} accent />
          <Stat
            label={mode === "under" ? "Roll under" : "Roll over"}
            value={target.toFixed(0)}
          />
          <Stat label="Win chance" value={`${chance.toFixed(1)}%`} />
        </div>
      </div>

      {/* controls */}
      <div className="px-3 pt-3 shrink-0">
        <div className="rounded-2xl border border-line bg-s1 p-3 space-y-3">
          <input
            type="range"
            min={MIN_TARGET}
            max={MAX_TARGET}
            step={1}
            value={target}
            disabled={rolling}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="w-full accent-[#c6f73c]"
          />

          <div className="grid grid-cols-2 gap-2">
            {(["under", "over"] as Mode[]).map((m) => (
              <button
                key={m}
                disabled={rolling}
                onClick={() => setMode(m)}
                className={`h-10 rounded-xl text-[13px] font-bold border transition-colors disabled:opacity-50 ${
                  mode === m
                    ? "bg-t1 text-bg border-t1"
                    : "bg-s2 text-t2 border-line"
                }`}
              >
                {m === "under" ? "▼ Roll under" : "▲ Roll over"}
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

function shownLerp(from: number, to: number, t: number) {
  const e = 1 - Math.pow(1 - t, 3);
  return from + (to - from) * e;
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
