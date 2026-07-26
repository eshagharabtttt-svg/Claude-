import { useEffect, useRef, useState } from "react";
import { BalancePill, Button } from "../../components/ui";
import { usePlayer } from "../../lib/store";
import { GameHeader } from "./GameHeader";

const STAKES = [50, 100, 250, 500];
const AUTOS = [1.5, 2, 3, 5, 10];

const BETTING_MS = 5_000;

/**
 * Crash point from a uniform draw. `95 / (1 - r)` gives a 95% return to
 * player — a 5% edge, the same one the pools take — with the familiar
 * heavy tail: median around 1.9x, occasional 50x+.
 */
function drawCrash(r: number) {
  return Math.max(1, Math.floor(95 / (1 - Math.min(r, 0.9999))) / 100);
}

/** Multiplier as a function of elapsed flight time */
function curve(ms: number) {
  return Math.max(1, Math.exp(0.00011 * ms));
}

/**
 * A stand-in for the server's commit hash. The real build must draw the
 * crash point server-side, publish its hash before the round, and reveal
 * the seed after — otherwise "provably fair" is just a label.
 */
function fakeHash(seed: number) {
  let h = 0x811c9dc5;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").repeat(4).slice(0, 32);
}

type Phase = "betting" | "flying" | "crashed";

type Rider = { name: string; at: number; out: boolean };

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

  /* ---- round loop ---- */
  useEffect(() => {
    let raf = 0;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const startRound = () => {
      const s = Math.floor(Math.random() * 1e9);
      const point = drawCrash(Math.random());
      setSeed(s);
      setMult(1);
      setCashedAt(null);
      setInPlay(false);
      setPhase("betting");
      setLeft(BETTING_MS);
      setRiders(
        NAMES.slice(0, 4 + Math.floor(Math.random() * 3)).map((name) => ({
          name,
          at: 1.2 + Math.random() * 4,
          out: false,
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
      }, 80);
      timers.push(countdown as unknown as ReturnType<typeof setTimeout>);
    };

    const fly = (point: number) => {
      startedAt.current = Date.now();
      setPhase("flying");

      const step = () => {
        const m = curve(Date.now() - startedAt.current);
        if (m >= point) {
          setMult(point);
          setPhase("crashed");
          setHistory((h) => [point, ...h].slice(0, 12));
          if (inPlayRef.current && cashedRef.current === null) buzz(180);
          setRiders((rs) => rs.map((r) => ({ ...r, out: r.at <= point })));
          timers.push(setTimeout(startRound, 3200));
          return;
        }
        setMult(m);
        setRiders((rs) => rs.map((r) => (m >= r.at ? { ...r, out: true } : r)));

        // auto cash-out
        const a = autoRef.current;
        if (inPlayRef.current && cashedRef.current === null && a && m >= a) {
          cashOutAt(a);
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const cashOutAt = (m: number) => {
      const payout = Math.round(stakeRef.current * m);
      cashedRef.current = m;
      setCashedAt(m);
      credit(payout, `Crash ×${m.toFixed(2)}`);
      buzz([30, 50, 30]);
    };

    startRound();
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      timers.forEach((t) => clearInterval(t as unknown as number));
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
    setCashedAt(m);
    cashedRef.current = m;
    credit(Math.round(stake * m), `Crash ×${m.toFixed(2)}`);
    buzz([30, 50, 30]);
  };

  const lost = phase === "crashed" && inPlay && cashedAt === null;
  const tone =
    phase === "crashed" ? "text-down" : cashedAt !== null ? "text-up" : "text-brand";

  return (
    <div className="h-full flex flex-col pb-[68px]">
      <GameHeader title="Crash" onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      {/* history */}
      <div className="hscroll flex gap-1.5 px-4 pb-3 shrink-0">
        {history.map((h, i) => (
          <span
            key={i}
            className={`shrink-0 mono text-[11px] font-bold px-2 py-1 rounded-md ${
              h >= 2 ? "bg-up/15 text-up" : "bg-down/15 text-down"
            }`}
          >
            {h.toFixed(2)}×
          </span>
        ))}
      </div>

      {/* stage */}
      <div className="flex-1 min-h-[200px] relative flex items-center justify-center overflow-hidden">
        <RocketTrail mult={mult} phase={phase} />

        <div className="relative text-center">
          {phase === "betting" ? (
            <>
              <div className="text-[12px] text-t3">Next round in</div>
              <div className="mono text-[52px] font-extrabold text-brand leading-none">
                {(left / 1000).toFixed(1)}
              </div>
            </>
          ) : (
            <>
              <div className={`mono text-[62px] font-extrabold leading-none ${tone}`}>
                {mult.toFixed(2)}×
              </div>
              {phase === "crashed" && (
                <div className="text-down text-[16px] font-extrabold mt-1 pop">
                  CRASHED
                </div>
              )}
              {cashedAt !== null && phase === "flying" && (
                <div className="text-up text-[14px] font-bold mt-1">
                  cashed at {cashedAt.toFixed(2)}× · +
                  {Math.round(stake * cashedAt).toLocaleString("en-US")} ◈
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* riders */}
      <div className="px-4 shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {riders.map((r) => (
            <span
              key={r.name}
              className={`text-[10px] px-2 py-1 rounded-md mono ${
                r.out
                  ? "bg-up/12 text-up"
                  : phase === "crashed"
                    ? "bg-down/12 text-down"
                    : "bg-s2 text-t3"
              }`}
            >
              {r.name} {r.out ? `${r.at.toFixed(2)}×` : "…"}
            </span>
          ))}
        </div>
      </div>

      {/* controls */}
      <div className="px-4 pt-3 shrink-0 space-y-2.5">
        <div className="hscroll flex gap-2">
          {STAKES.map((s) => (
            <button
              key={s}
              disabled={inPlay}
              onClick={() => setStake(s)}
              className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-bold disabled:opacity-40 ${
                s === stake ? "bg-t1 text-bg" : "bg-s2 text-t2 border border-line"
              }`}
            >
              <span className="mono">{s}</span> ◈
            </button>
          ))}
        </div>

        <div className="hscroll flex gap-2 items-center">
          <span className="text-[11px] text-t3 shrink-0">Auto</span>
          <button
            onClick={() => setAuto(null)}
            className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-bold ${
              auto === null ? "bg-t1 text-bg" : "bg-s2 text-t3 border border-line"
            }`}
          >
            off
          </button>
          {AUTOS.map((a) => (
            <button
              key={a}
              onClick={() => setAuto(a)}
              className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-bold mono ${
                auto === a ? "bg-t1 text-bg" : "bg-s2 text-t3 border border-line"
              }`}
            >
              {a}×
            </button>
          ))}
        </div>

        {phase === "flying" && inPlay && cashedAt === null ? (
          <Button size="lg" className="w-full" onClick={cashOut}>
            Cash out {Math.round(stake * mult).toLocaleString("en-US")} ◈
          </Button>
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
                  ? "Lost this round"
                  : "In this round"
              : phase === "betting"
                ? `Bet ${stake} ◈`
                : "Wait for next round"}
          </Button>
        )}

        <div className="flex items-center justify-between text-[10px] text-t3">
          <span>Provably fair · commit</span>
          <span className="mono truncate max-w-[180px]">
            {phase === "crashed" ? `seed ${seed}` : fakeHash(seed).slice(0, 16)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Rising trail behind the multiplier — cheap canvas-free flourish */
function RocketTrail({ mult, phase }: { mult: number; phase: Phase }) {
  const pct = Math.min(1, Math.log(mult) / Math.log(20));
  return (
    <div className="absolute inset-0">
      <div
        className={`absolute bottom-0 left-0 origin-bottom-left transition-opacity ${
          phase === "crashed" ? "opacity-25" : "opacity-100"
        }`}
        style={{
          width: `${20 + pct * 80}%`,
          height: `${15 + pct * 70}%`,
          background:
            phase === "crashed"
              ? "linear-gradient(to top right, rgba(240,97,109,.28), transparent 70%)"
              : "linear-gradient(to top right, rgba(198,247,60,.22), transparent 70%)",
          clipPath: "polygon(0 100%, 100% 0, 100% 100%)",
        }}
      />
    </div>
  );
}
