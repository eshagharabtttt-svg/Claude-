import { useEffect, useMemo, useRef, useState } from "react";
import { Chart, type Marker } from "../../components/Chart";
import { BalancePill, Button, Card } from "../../components/ui";
import { fmtPrice, getFeed, type AssetId } from "../../lib/feed";
import { usePlayer } from "../../lib/store";
import { useFullScreen } from "../../lib/chrome";
import { GameHeader } from "./GameHeader";

const ASSETS: AssetId[] = ["ETH", "BTC", "SOL"];
const STAKES = [50, 100, 250, 500];

/**
 * Payout ladder. Each rung is a coin flip paying 1.9x, which leaves a 5%
 * house edge per step — the run gets exponentially richer and
 * exponentially less likely at the same time, which is the whole tension.
 */
const LADDER = [1.9, 3.6, 6.9, 13.1, 24.8, 47.2, 89.7, 170.4];

/**
 * Shot window. Free play only — the design doc puts the floor at 30s for
 * real money, because a shorter window is exploitable by anyone with a
 * faster feed than ours.
 */
const SHOT_MS = 8_000;

type Phase = "idle" | "live" | "won" | "bust";
type Side = "up" | "down";

function buzz(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

export function StreakRun({ onBack }: { onBack: () => void }) {
  useFullScreen();
  const { p, credit, spendEnergy, recordResult } = usePlayer();
  const [asset, setAsset] = useState<AssetId>("ETH");
  const [stake, setStake] = useState(100);
  const [phase, setPhase] = useState<Phase>("idle");
  const [streak, setStreak] = useState(0);
  const [price, setPrice] = useState(getFeed("ETH").price);
  const [shot, setShot] = useState<{ side: Side; lock: number } | null>(null);
  const [left, setLeft] = useState(SHOT_MS);
  const [best, setBest] = useState(0);

  const firedAt = useRef(0);

  useEffect(() => {
    const f = getFeed(asset);
    setPrice(f.price);
    return f.sub((t) => setPrice(t.p));
  }, [asset]);

  // resolve the open shot
  useEffect(() => {
    if (!shot) return;
    const t = setInterval(() => {
      const elapsed = Date.now() - firedAt.current;
      setLeft(Math.max(0, SHOT_MS - elapsed));
      if (elapsed < SHOT_MS) return;

      clearInterval(t);
      const close = getFeed(asset).price;
      const won = shot.side === "up" ? close >= shot.lock : close < shot.lock;
      setShot(null);

      if (won) {
        setStreak((s) => {
          const next = s + 1;
          setBest((b) => Math.max(b, next));
          return next;
        });
        recordResult(true, 15);
        buzz([25, 45, 25]);
      } else {
        setPhase("bust");
        recordResult(false, -5);
        buzz(160);
      }
    }, 100);
    return () => clearInterval(t);
  }, [shot, asset, recordResult]);

  const start = () => {
    if (p.balance < stake || !spendEnergy(1)) return;
    credit(-stake, "Streak run entry");
    setStreak(0);
    setPhase("live");
    buzz(30);
  };

  const fire = (side: Side) => {
    if (phase !== "live" || shot) return;
    firedAt.current = Date.now();
    setLeft(SHOT_MS);
    setShot({ side, lock: getFeed(asset).price });
    buzz(35);
  };

  const cashOut = () => {
    const payout = Math.round(stake * (LADDER[streak - 1] ?? 1));
    credit(payout, `Streak run ×${streak}`);
    setPhase("won");
    buzz([40, 60, 40, 60, 90]);
  };

  const reset = () => {
    setPhase("idle");
    setStreak(0);
    setShot(null);
  };

  const mult = LADDER[Math.max(0, streak - 1)] ?? 1;
  const nextMult = LADDER[streak] ?? LADDER.at(-1)!;
  const pot = Math.round(stake * mult);
  const delta = shot ? price - shot.lock : 0;
  const winning = shot
    ? shot.side === "up"
      ? delta >= 0
      : delta < 0
    : null;

  const lines: Marker[] = useMemo(
    () =>
      shot
        ? [
            {
              price: shot.lock,
              color: shot.side === "up" ? "#16c784" : "#f0616d",
              title: "SHOT",
              dashed: true,
            },
          ]
        : [],
    [shot]
  );

  return (
    <div className="h-full flex flex-col pb-1">
      <GameHeader title="Streak Run" onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      {/* ladder */}
      <div className="hscroll flex gap-1.5 px-4 pb-2 shrink-0">
        {LADDER.map((m, i) => {
          const done = i < streak;
          const next = i === streak;
          return (
            <div
              key={m}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-center border ${
                done
                  ? "bg-brand/20 border-brand/50"
                  : next
                    ? "bg-s2 border-brand/40"
                    : "bg-s2 border-line"
              }`}
            >
              <div
                className={`mono text-[12px] font-bold ${
                  done ? "text-brand" : next ? "text-t1" : "text-t3"
                }`}
              >
                ×{m}
              </div>
            </div>
          );
        })}
      </div>

      {/* status */}
      <div className="flex items-end justify-between px-4 pb-2 shrink-0">
        <div>
          <div className="text-[10px] text-t3">{asset}/USDT</div>
          <div className="mono text-[30px] font-bold leading-none mt-0.5">
            {fmtPrice(price, asset)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-t3">
            {phase === "live" ? `Streak ${streak}` : "Best streak"}
          </div>
          <div className="mono text-[30px] font-extrabold leading-none text-brand">
            {phase === "live" ? `×${mult}` : best}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[160px]">
        <Chart
          asset={asset}
          lines={lines}
          tone={winning === null ? "brand" : winning ? "up" : "down"}
        />
      </div>

      {/* controls */}
      {phase === "idle" && (
        <div className="px-4 pt-3 shrink-0 space-y-3">
          <div className="hscroll flex gap-2">
            {ASSETS.map((a) => (
              <button
                key={a}
                onClick={() => setAsset(a)}
                className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-bold ${
                  a === asset ? "bg-t1 text-bg" : "bg-s2 text-t2 border border-line"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="hscroll flex gap-2">
            {STAKES.map((s) => (
              <button
                key={s}
                onClick={() => setStake(s)}
                className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-bold ${
                  s === stake ? "bg-t1 text-bg" : "bg-s2 text-t2 border border-line"
                }`}
              >
                <span className="mono">{s}</span> ◈
              </button>
            ))}
          </div>
          <Button
            size="lg"
            className="w-full"
            disabled={p.balance < stake}
            onClick={start}
          >
            {p.balance < stake ? "Not enough balance" : `Start run · ${stake} ◈`}
          </Button>
          <p className="text-center text-[11px] text-t3">
            Every correct call climbs the ladder. Cash out any time — one wrong
            call and the run is over.
          </p>
        </div>
      )}

      {phase === "live" && (
        <div className="px-4 pt-3 shrink-0 space-y-3">
          {shot ? (
            <div className="text-center">
              <div className="mono text-[26px] font-bold text-warn">
                {(left / 1000).toFixed(1)}s
              </div>
              <div className="text-[12px] text-t2 mt-0.5">
                {shot.side === "up" ? "▲ UP" : "▼ DOWN"} from{" "}
                <span className="mono">{fmtPrice(shot.lock, asset)}</span> ·{" "}
                <span className={winning ? "text-up" : "text-down"}>
                  {winning ? "winning" : "losing"}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => fire("up")}
                  className="h-[58px] rounded-2xl bg-up/15 border border-up/40 text-up font-extrabold text-[16px] active:bg-up/30"
                >
                  ↑ UP
                </button>
                <button
                  onClick={() => fire("down")}
                  className="h-[58px] rounded-2xl bg-down/15 border border-down/40 text-down font-extrabold text-[16px] active:bg-down/30"
                >
                  ↓ DOWN
                </button>
              </div>
              {streak > 0 && (
                <Button size="lg" className="w-full" onClick={cashOut}>
                  Cash out {pot.toLocaleString("en-US")} ◈
                </Button>
              )}
              <p className="text-center text-[11px] text-t3">
                {streak === 0
                  ? "Fire when you like — the shot settles 8s later"
                  : `Next correct call pays ×${nextMult}`}
              </p>
            </>
          )}
        </div>
      )}

      {(phase === "won" || phase === "bust") && (
        <div className="px-4 pt-3 shrink-0 space-y-3">
          <Card
            className={`p-4 text-center slideup ${
              phase === "won" ? "border-up/50" : "border-down/50"
            }`}
          >
            <div className="text-[36px] leading-none pop">
              {phase === "won" ? "🏆" : "💀"}
            </div>
            <div
              className={`text-[20px] font-extrabold mt-1 ${
                phase === "won" ? "text-up" : "text-down"
              }`}
            >
              {phase === "won" ? "Cashed out" : "Run over"}
            </div>
            <div className="mono text-[13px] text-t2 mt-1">
              {phase === "won"
                ? `${streak} in a row · +${pot.toLocaleString("en-US")} ◈`
                : `Streak ended at ${streak}`}
            </div>
          </Card>
          <Button size="lg" className="w-full" onClick={reset}>
            Run again
          </Button>
        </div>
      )}
    </div>
  );
}
