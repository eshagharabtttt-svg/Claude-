import { useEffect, useRef, useState } from "react";
import { BalancePill, Button } from "../../components/ui";
import { usePlayer } from "../../lib/store";
import { useFullScreen } from "../../lib/chrome";
import { GameHeader } from "./GameHeader";
import { CrashCurve, curve } from "./CrashCurve";

const STAKES = [50, 100, 250, 500];
const AUTOS = [1.5, 2, 3, 5, 10];

const BETTING_MS = 5_000;
const AFTER_MS = 3_400;

/**
 * Crash point from a uniform draw. `95 / (1 - r)` returns 95% to the
 * player — the same 5% the pools take — with the familiar heavy tail:
 * median near 1.9x, the occasional 50x.
 */
function drawCrash(r: number) {
  return Math.max(1, Math.floor(95 / (1 - Math.min(r, 0.9999))) / 100);
}

/**
 * Stand-in for the server's commit hash. The real build must draw the
 * crash point server-side, publish its hash before the round and reveal
 * the seed after — otherwise "provably fair" is only a label.
 */
function fakeHash(seed: number) {
  let h = 0x811c9dc5;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").repeat(4).slice(0, 24);
}

type Phase = "betting" | "flying" | "crashed";
type Rider = { name: string; at: number; out: boolean; stake: number };

const NAMES = ["Sara", "Kian", "MoonBoy", "Reza_TR", "Nima", "DegenX", "Yas"];

function buzz(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

export function Crash({ onBack }: { onBack: () => void }) {
  useFullScreen();
  const { p, credit } = usePlayer();
  const [phase, setPhase] = useState<Phase>("betting");
  const [mult, setMult] = useState(1);
  const [seed, setSeed] = useState(1);
  const [left, setLeft] = useState(BETTING_MS);
  const [stake, setStake] = useState(100);
  const [auto, setAuto] = useState<number | null>(2);
  const [inPlay, setInPlay] = useState(false);
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([2.14, 1.08, 5.6, 1.42, 12.3]);
  const [riders, setRiders] = useState<Rider[]>([]);

  const startedAt = useRef(0);
  const inPlayRef = useRef(false);
  inPlayRef.current = inPlay;
  const cashedRef = useRef<number | null>(null);
  cashedRef.current = cashedAt;
  const autoRef = useRef<number | null>(auto);
  autoRef.current = auto;
  const stakeRef = useRef(stake);
  stakeRef.current = stake;

  useEffect(() => {
    let raf = 0;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const cashOutAt = (m: number) => {
      cashedRef.current = m;
      setCashedAt(m);
      credit(Math.round(stakeRef.current * m), `Crash ×${m.toFixed(2)}`);
      buzz([30, 50, 30]);
    };

    const fly = (point: number) => {
      startedAt.current = Date.now();
      setPhase("flying");

      const step = () => {
        const m = curve(Date.now() - startedAt.current);

        if (m >= point) {
          setMult(point);
          setPhase("crashed");
          setHistory((h) => [point, ...h].slice(0, 14));
          setRiders((rs) => rs.map((r) => ({ ...r, out: r.at <= point })));
          if (inPlayRef.current && cashedRef.current === null) buzz(200);
          timers.push(setTimeout(startRound, AFTER_MS));
          return;
        }

        setMult(m);
        setRiders((rs) =>
          rs.some((r) => !r.out && m >= r.at)
            ? rs.map((r) => (m >= r.at ? { ...r, out: true } : r))
            : rs
        );

        const a = autoRef.current;
        if (inPlayRef.current && cashedRef.current === null && a && m >= a) {
          cashOutAt(a);
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const startRound = () => {
      const s = Math.floor(Math.random() * 1e9);
      const point = drawCrash(Math.random());
      setSeed(s);
      setMult(1);
      setCashedAt(null);
      cashedRef.current = null;
      setInPlay(false);
      setPhase("betting");
      setLeft(BETTING_MS);
      setRiders(
        NAMES.slice(0, 4 + Math.floor(Math.random() * 3)).map((name) => ({
          name,
          at: 1.15 + Math.random() * 4.5,
          out: false,
          stake: [50, 100, 250, 500][Math.floor(Math.random() * 4)],
        }))
      );

      const openedAt = Date.now();
      const countdown = setInterval(() => {
        const r = BETTING_MS - (Date.now() - openedAt);
        setLeft(Math.max(0, r));
        if (r <= 0) {
          clearInterval(countdown);
          fly(point);
        }
      }, 60);
      timers.push(countdown as unknown as ReturnType<typeof setTimeout>);
    };

    startRound();
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => {
        clearTimeout(t);
        clearInterval(t as unknown as number);
      });
      timers = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const join = () => {
    if (phase !== "betting" || inPlay || p.balance < stake) return;
    credit(-stake, "Crash bet");
    setInPlay(true);
    buzz(30);
  };

  const cashOut = () => {
    if (phase !== "flying" || !inPlay || cashedAt !== null) return;
    const m = mult;
    cashedRef.current = m;
    setCashedAt(m);
    credit(Math.round(stake * m), `Crash ×${m.toFixed(2)}`);
    buzz([30, 50, 30]);
  };

  const lost = phase === "crashed" && inPlay && cashedAt === null;
  const live = phase === "flying" && inPlay && cashedAt === null;

  return (
    <div className="h-full flex flex-col pb-1">
      <GameHeader title="Crash" onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      {/* past rounds */}
      <div className="hscroll flex gap-1.5 px-4 pb-2 shrink-0">
        {history.map((h, i) => (
          <span
            key={`${h}-${i}`}
            className={`shrink-0 mono text-[11px] font-bold px-2 py-1 rounded-md ${
              h >= 10
                ? "bg-brand/20 text-brand"
                : h >= 2
                  ? "bg-up/15 text-up"
                  : "bg-down/15 text-down"
            }`}
          >
            {h.toFixed(2)}×
          </span>
        ))}
      </div>

      {/* stage */}
      <div className="flex-1 min-h-[220px] relative mx-3 rounded-2xl border border-line bg-s1/60 overflow-hidden">
        <CrashCurve
          mult={mult}
          crashed={phase === "crashed"}
          idle={phase === "betting"}
          markers={riders.filter((r) => r.out).map((r) => ({
            name: r.name,
            at: r.at,
          }))}
        />

        {/* the number sits on top of the curve, so it gets its own veil */}
        {phase !== "betting" && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(46% 24% at 50% 48%, rgba(10,10,11,.82), transparent 70%)",
            }}
          />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {phase === "betting" ? (
            <>
              <div className="text-[11px] text-t3 tracking-wide">
                NEXT ROUND IN
              </div>
              <div className="mono text-[46px] font-extrabold text-brand leading-none mt-1">
                {(left / 1000).toFixed(1)}
              </div>
              <div className="mt-3 h-1 w-32 rounded-full bg-s3 overflow-hidden">
                <div
                  className="h-full bg-brand"
                  style={{ width: `${(left / BETTING_MS) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div
                className={`mono font-extrabold leading-none ${
                  phase === "crashed"
                    ? "text-down text-[54px]"
                    : cashedAt !== null
                      ? "text-up text-[58px]"
                      : "text-t1 text-[58px]"
                }`}
                style={
                  phase === "flying"
                    ? { textShadow: "0 0 28px rgba(198,247,60,.35)" }
                    : undefined
                }
              >
                {mult.toFixed(2)}×
              </div>
              {phase === "crashed" && (
                <div className="mt-2 px-3 py-1 rounded-lg bg-down/20 border border-down/50 pop">
                  <span className="text-down text-[13px] font-extrabold tracking-widest">
                    CRASHED
                  </span>
                </div>
              )}
              {cashedAt !== null && (
                <div className="mt-2 text-up text-[13px] font-bold">
                  out at {cashedAt.toFixed(2)}× · +
                  {Math.round(stake * cashedAt).toLocaleString("en-US")} ◈
                </div>
              )}
              {lost && (
                <div className="mt-2 text-down text-[13px] font-bold">
                  −{stake.toLocaleString("en-US")} ◈
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* riders */}
      <div className="hscroll flex gap-1.5 px-4 pt-2.5 shrink-0">
        {riders.map((r) => (
          <span
            key={r.name}
            className={`shrink-0 flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg border ${
              r.out
                ? "bg-up/10 border-up/30 text-up"
                : phase === "crashed"
                  ? "bg-down/10 border-down/30 text-down"
                  : "bg-s2 border-line text-t3"
            }`}
          >
            <span className="font-semibold">{r.name}</span>
            <span className="mono">
              {r.out ? `${r.at.toFixed(2)}×` : phase === "crashed" ? "✕" : "···"}
            </span>
          </span>
        ))}
      </div>

      {/* bet panel */}
      <div className="px-3 pt-3 shrink-0">
        <div className="rounded-2xl border border-line bg-s1 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-t3 w-9 shrink-0">Bet</span>
            <div className="hscroll flex gap-1.5 flex-1">
              {STAKES.map((s) => (
                <button
                  key={s}
                  disabled={inPlay}
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

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-t3 w-9 shrink-0">Auto</span>
            <div className="hscroll flex gap-1.5 flex-1">
              <button
                onClick={() => setAuto(null)}
                className={`shrink-0 h-8 px-3 rounded-lg text-[12px] font-bold ${
                  auto === null ? "bg-t1 text-bg" : "bg-s2 text-t3"
                }`}
              >
                off
              </button>
              {AUTOS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAuto(a)}
                  className={`shrink-0 h-8 px-3 rounded-lg text-[12px] font-bold mono ${
                    auto === a ? "bg-t1 text-bg" : "bg-s2 text-t3"
                  }`}
                >
                  {a}×
                </button>
              ))}
            </div>
          </div>

          {live ? (
            <button
              onClick={cashOut}
              className="w-full h-14 rounded-2xl bg-up text-bg font-extrabold text-[17px] active:brightness-90"
            >
              Cash out {Math.round(stake * mult).toLocaleString("en-US")} ◈
            </button>
          ) : (
            <Button
              size="lg"
              className="w-full"
              disabled={phase !== "betting" || inPlay || p.balance < stake}
              onClick={join}
            >
              {inPlay
                ? cashedAt !== null
                  ? `Cashed ${cashedAt.toFixed(2)}×`
                  : lost
                    ? "Crashed — better luck next round"
                    : "You're in this round"
                : phase === "betting"
                  ? `Bet ${stake} ◈`
                  : "Waiting for next round"}
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] text-t3 px-1 pt-2">
          <span>
            {phase === "crashed" ? "revealed seed" : "commit hash"} · provably fair
          </span>
          <span className="mono truncate max-w-[150px]">
            {phase === "crashed" ? seed : fakeHash(seed)}
          </span>
        </div>
      </div>
    </div>
  );
}
