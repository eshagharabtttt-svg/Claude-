import { useEffect, useMemo, useRef, useState } from "react";
import { Chart, type Marker } from "../components/Chart";
import { BalancePill } from "../components/ui";
import { fmtPrice, getFeed, mmss, type AssetId } from "../lib/feed";
import { usePlayer } from "../lib/store";

const ASSETS: AssetId[] = ["ETH", "BTC", "TON", "SOL"];
const STAKES = [50, 100, 250, 500];

/** Round length and betting window — served by the backend in production */
const BET_WINDOW = 20_000;
const ROUND_LEN = 30_000;
const RESULT_HOLD = 6_000;

type Phase = "betting" | "locked" | "result";
type Side = "up" | "down";
type Bet = { side: Side; stake: number; entry: number };

type Outcome = {
  side: Side;
  won: boolean;
  payout: number;
  lock: number;
  close: number;
};

function buzz(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* some browsers refuse without a gesture */
    }
  }
}

export function QuickPlay() {
  const { p, credit, spendEnergy, recordResult } = usePlayer();
  const [asset, setAsset] = useState<AssetId>("ETH");
  const [phase, setPhase] = useState<Phase>("betting");
  const [left, setLeft] = useState(BET_WINDOW);
  const [price, setPrice] = useState(getFeed("ETH").price);
  const [source, setSource] = useState(getFeed("ETH").source);
  const [lockPrice, setLockPrice] = useState<number | null>(null);
  const [bet, setBet] = useState<Bet | null>(null);
  const [stake, setStake] = useState(100);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [history, setHistory] = useState<Side[]>(["up", "down", "up", "up"]);
  const [pools, setPools] = useState({ up: 1800, down: 1400 });

  const betRef = useRef<Bet | null>(null);
  betRef.current = bet;
  const startedAt = useRef(Date.now());

  // live price
  useEffect(() => {
    const f = getFeed(asset);
    setPrice(f.price);
    setSource(f.source);
    return f.sub((t) => {
      setPrice(t.p);
      setSource(f.source);
    });
  }, [asset]);

  // round cycle
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];

    const run = () => {
      startedAt.current = Date.now();
      setPhase("betting");
      setBet(null);
      setOutcome(null);
      setLockPrice(null);
      setPools({
        up: 900 + Math.round(Math.random() * 2200),
        down: 900 + Math.round(Math.random() * 2200),
      });

      timers.push(
        setTimeout(() => {
          const lock = getFeed(asset).price;
          setLockPrice(lock);
          setPhase("locked");
          buzz(20);

          timers.push(
            setTimeout(() => {
              const close = getFeed(asset).price;
              const winner: Side = close >= lock ? "up" : "down";
              setHistory((h) => [winner, ...h].slice(0, 8));
              setPhase("result");

              const b = betRef.current;
              if (b) {
                const total = pools.up + pools.down + b.stake;
                const mine = (b.side === "up" ? pools.up : pools.down) + b.stake;
                const won = b.side === winner;
                const payout = won
                  ? Math.round((b.stake * (total * 0.97)) / mine)
                  : 0;
                setOutcome({ side: b.side, won, payout, lock, close });
                if (won) credit(payout, "Round win");
                recordResult(won, won ? 25 : -5);
                buzz(won ? [30, 60, 30] : 120);
              }

              timers.push(setTimeout(run, RESULT_HOLD));
            }, ROUND_LEN - BET_WINDOW)
          );
        }, BET_WINDOW)
      );
    };

    run();
    return () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  // display timer
  useEffect(() => {
    const t = setInterval(() => {
      const el = Date.now() - startedAt.current;
      setLeft(phase === "betting" ? BET_WINDOW - el : ROUND_LEN - el);
      if (phase === "betting" && el < BET_WINDOW) {
        setPools((s) => ({
          up: s.up + Math.round(Math.random() * 26),
          down: s.down + Math.round(Math.random() * 26),
        }));
      }
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  const place = (side: Side) => {
    if (phase !== "betting" || bet) return;
    if (p.balance < stake) return;
    if (!spendEnergy(1)) return;
    credit(-stake, side === "up" ? "Bet UP" : "Bet DOWN");
    setBet({ side, stake, entry: getFeed(asset).price });
    buzz(35);
  };

  const total = pools.up + pools.down;
  const upPct = Math.round((pools.up / total) * 100);
  const multUp = ((total * 0.97) / pools.up).toFixed(2);
  const multDown = ((total * 0.97) / pools.down).toFixed(2);
  const secs = Math.max(0, Math.ceil(left / 1000));
  const urgent = phase !== "result" && secs <= 5;

  const ref = lockPrice ?? bet?.entry ?? null;
  const delta = ref ? price - ref : 0;
  const tone = ref ? (delta >= 0 ? "up" : "down") : "brand";

  const lines: Marker[] = useMemo(() => {
    const out: Marker[] = [];
    if (bet) out.push({ price: bet.entry, color: "#f5a524", title: "ENTRY" });
    if (lockPrice)
      out.push({
        price: lockPrice,
        color: "#8a8a93",
        title: "LOCK",
        dashed: true,
      });
    return out;
  }, [bet, lockPrice]);

  const canBet = phase === "betting" && !bet;

  return (
    <div className="h-full flex flex-col pb-[68px]">
      {/* header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="hscroll flex gap-1.5">
            {ASSETS.map((a) => (
              <button
                key={a}
                onClick={() => setAsset(a)}
                className={`shrink-0 h-8 px-3 rounded-lg text-[12px] font-bold transition-colors ${
                  a === asset ? "bg-t1 text-bg" : "bg-s2 text-t3"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <BalancePill value={p.balance} />
      </header>

      {/* price + timer */}
      <div className="flex items-end justify-between px-4 pb-2 shrink-0">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                source === "binance" ? "bg-up live-dot" : "bg-warn"
              }`}
            />
            <span className="text-[10px] text-t3">
              {asset}/USDT · {source === "binance" ? "Binance" : "simulated"}
            </span>
          </div>
          <div className="mono text-[34px] font-bold leading-none mt-1">
            {fmtPrice(price, asset)}
          </div>
          {ref && (
            <div
              className={`mono text-[13px] font-bold mt-1 ${
                delta >= 0 ? "text-up" : "text-down"
              }`}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-[10px] text-t3">
            {phase === "betting"
              ? "Betting closes in"
              : phase === "locked"
                ? "Result in"
                : "Next round"}
          </div>
          <div
            className={`mono text-[30px] font-bold leading-none ${
              urgent ? "text-down" : phase === "locked" ? "text-warn" : "text-brand"
            }`}
          >
            {phase === "result" ? "--" : mmss(left)}
          </div>
        </div>
      </div>

      {/* chart fills whatever is left */}
      <div className="flex-1 min-h-[180px] relative">
        <Chart asset={asset} lines={lines} tone={tone} />

        {outcome && (
          <div className="absolute inset-x-4 top-3 slideup">
            <div
              className={`rounded-2xl border px-4 py-3 text-center backdrop-blur ${
                outcome.won
                  ? "border-up/50 bg-up/12"
                  : "border-down/50 bg-down/12"
              }`}
            >
              <div
                className={`text-[19px] font-extrabold tracking-wide ${
                  outcome.won ? "text-up" : "text-down"
                }`}
              >
                {outcome.won ? "YOU WON" : "YOU LOST"}
              </div>
              {outcome.won ? (
                <div className="mono text-brand text-[22px] font-bold mt-0.5">
                  +{outcome.payout.toLocaleString("en-US")} ◈
                </div>
              ) : (
                <div className="mono text-t2 text-[12px] mt-1">
                  {fmtPrice(outcome.lock, asset)} →{" "}
                  {fmtPrice(outcome.close, asset)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* pool + recent */}
      <div className="px-4 pt-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="mono text-[11px] font-bold text-up w-8">{upPct}%</span>
          <div className="flex-1 h-1.5 rounded-full bg-down/30 overflow-hidden">
            <div
              className="bg-up h-full transition-all duration-500"
              style={{ width: `${upPct}%` }}
            />
          </div>
          <span className="mono text-[11px] font-bold text-down w-8 text-right">
            {100 - upPct}%
          </span>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            {history.slice(0, 6).map((h, i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded text-[9px] font-bold flex items-center justify-center ${
                  h === "up" ? "bg-up/15 text-up" : "bg-down/15 text-down"
                }`}
              >
                {h === "up" ? "▲" : "▼"}
              </span>
            ))}
          </div>
          <span className="mono text-[10px] text-t3">
            pool {total.toLocaleString("en-US")} ◈
          </span>
        </div>
      </div>

      {/* stake */}
      <div className="hscroll flex gap-2 px-4 pt-3 shrink-0">
        {STAKES.map((s) => (
          <button
            key={s}
            disabled={!canBet}
            onClick={() => setStake(s)}
            className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-bold transition-colors disabled:opacity-40 ${
              s === stake ? "bg-t1 text-bg" : "bg-s2 text-t2 border border-line"
            }`}
          >
            <span className="mono">{s}</span> ◈
          </button>
        ))}
      </div>

      {/* hint */}
      <div className="text-center text-[12px] text-t3 px-4 pt-3 shrink-0">
        {bet ? (
          <span className="text-t2">
            <span className="mono">{bet.stake}</span> ◈ on{" "}
            <span className={bet.side === "up" ? "text-up" : "text-down"}>
              {bet.side === "up" ? "UP" : "DOWN"}
            </span>{" "}
            at <span className="mono">{fmtPrice(bet.entry, asset)}</span>
          </span>
        ) : phase === "betting" ? (
          <>ⓘ Call where the price lands 30 seconds from now</>
        ) : (
          "Betting closed — watching the price"
        )}
      </div>

      {/* actions */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-3 shrink-0">
        <button
          disabled={!canBet}
          onClick={() => place("up")}
          className={`h-[62px] rounded-2xl flex items-center justify-center gap-2 font-extrabold text-[17px] transition-all disabled:opacity-35 ${
            bet?.side === "up"
              ? "bg-up text-bg"
              : "bg-up/15 text-up border border-up/40 active:bg-up/30"
          }`}
        >
          <span className="text-[19px]">↑</span> UP
          <span className="mono text-[12px] opacity-70">×{multUp}</span>
        </button>

        <button
          disabled={!canBet}
          onClick={() => place("down")}
          className={`h-[62px] rounded-2xl flex items-center justify-center gap-2 font-extrabold text-[17px] transition-all disabled:opacity-35 ${
            bet?.side === "down"
              ? "bg-down text-bg"
              : "bg-down/15 text-down border border-down/40 active:bg-down/30"
          }`}
        >
          <span className="text-[19px]">↓</span> DOWN
          <span className="mono text-[12px] opacity-70">×{multDown}</span>
        </button>
      </div>
    </div>
  );
}
