import { useEffect, useRef, useState } from "react";
import { Chart, type Marker } from "../components/Chart";
import { BalancePill, Button, Card, Chip, LiveBadge } from "../components/ui";
import { assetLabel, fmtPrice, getFeed, mmss, type AssetId } from "../lib/feed";
import { usePlayer } from "../lib/store";

const ASSETS: AssetId[] = ["ETH", "BTC", "TON", "SOL"];
const STAKES = [50, 100, 250, 500];

/** طول راند و پنجره‌ی شرط — در نسخه‌ی واقعی از سرور می‌آید */
const BET_WINDOW = 20_000;
const ROUND_LEN = 30_000;
const RESULT_HOLD = 6_000;

type Phase = "betting" | "locked" | "result";
type Side = "up" | "down";

type Bet = { side: Side; stake: number };

type Outcome = {
  side: Side;
  stake: number;
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
      /* بعضی مرورگرها اجازه نمی‌دهند */
    }
  }
}

export function QuickPlay() {
  const { p, credit, spendEnergy, recordResult } = usePlayer();
  const [asset, setAsset] = useState<AssetId>("ETH");
  const [phase, setPhase] = useState<Phase>("betting");
  const [left, setLeft] = useState(BET_WINDOW);
  const [price, setPrice] = useState(getFeed("ETH").price);
  const [lockPrice, setLockPrice] = useState<number | null>(null);
  const [bet, setBet] = useState<Bet | null>(null);
  const [stake, setStake] = useState(100);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [history, setHistory] = useState<Side[]>(["up", "down", "up", "up", "down"]);
  const [pools, setPools] = useState({ up: 1800, down: 1400 });

  const betRef = useRef<Bet | null>(null);
  betRef.current = bet;
  const startedAt = useRef(Date.now());

  // قیمت زنده
  useEffect(() => {
    const f = getFeed(asset);
    setPrice(f.price);
    return f.sub((t) => setPrice(t.p));
  }, [asset]);

  // چرخه‌ی راند
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
                const mult = (total * 0.97) / mine;
                const won = b.side === winner;
                const payout = won ? Math.round(b.stake * mult) : 0;
                setOutcome({ side: b.side, stake: b.stake, won, payout, lock, close });
                if (won) credit(payout, "برد راند");
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

  // تایمر نمایش
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
    credit(-stake, `شرط ${side === "up" ? "صعود" : "نزول"}`);
    setBet({ side, stake });
    buzz(35);
  };

  const total = pools.up + pools.down;
  const upPct = Math.round((pools.up / total) * 100);
  const multUp = ((total * 0.97) / pools.up).toFixed(2);
  const multDown = ((total * 0.97) / pools.down).toFixed(2);
  const secs = Math.max(0, Math.ceil(left / 1000));
  const urgent = phase === "betting" && secs <= 5;

  const delta = lockPrice ? price - lockPrice : 0;
  const lines: Marker[] = lockPrice
    ? [{ price: lockPrice, color: "#a2a2ac", title: "LOCK", dashed: true }]
    : [];

  return (
    <div className="vscroll h-full pb-28">
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight">بازی سریع</h1>
          <p className="text-t3 text-xs mt-0.5">پیش‌بینی کن، ۳۰ ثانیه صبر کن</p>
        </div>
        <BalancePill value={p.balance} />
      </header>

      <div className="hscroll flex gap-2 px-4 pb-4">
        {ASSETS.map((a) => (
          <Chip key={a} active={a === asset} onClick={() => setAsset(a)}>
            {a}
          </Chip>
        ))}
      </div>

      <div className="px-4">
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between p-4 pb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold">{asset}/USDT</span>
                <LiveBadge />
              </div>
              <div className="mono text-[30px] font-bold mt-1 leading-none">
                {fmtPrice(price, asset)}
              </div>
              <div className="text-t3 text-[11px] mt-1">{assetLabel(asset)}</div>
            </div>

            <div className="text-left">
              <div className="text-[11px] text-t3 mb-1">
                {phase === "betting"
                  ? "بسته شدن شرط"
                  : phase === "locked"
                    ? "تا نتیجه"
                    : "راند بعدی"}
              </div>
              <div
                className={`mono text-[28px] font-bold leading-none ${
                  urgent ? "text-down" : phase === "locked" ? "text-warn" : "text-brand"
                }`}
              >
                {phase === "result" ? "--" : mmss(left)}
              </div>
              {lockPrice && (
                <div
                  className={`mono text-[12px] mt-1.5 font-bold ${
                    delta >= 0 ? "text-up" : "text-down"
                  }`}
                >
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          <Chart asset={asset} height={200} lines={lines} tone={
            lockPrice ? (delta >= 0 ? "up" : "down") : "brand"
          } />

          <div className="flex items-center gap-1.5 px-4 py-3 border-t border-line">
            <span className="text-[11px] text-t3 ml-1">راندهای اخیر</span>
            {history.map((h, i) => (
              <span
                key={i}
                className={`h-5 w-5 rounded-md text-[10px] font-bold flex items-center justify-center ${
                  h === "up" ? "bg-up/15 text-up" : "bg-down/15 text-down"
                }`}
              >
                {h === "up" ? "▲" : "▼"}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* استخر */}
      <div className="px-4 mt-3">
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className="text-up font-bold mono">{upPct}% صعود</span>
          <span className="text-down font-bold mono">{100 - upPct}% نزول</span>
        </div>
        <div className="h-2 rounded-full bg-down/25 overflow-hidden flex">
          <div
            className="bg-up h-full transition-all duration-500"
            style={{ width: `${upPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-t3 mt-1.5 mono">
          <span>{pools.up.toLocaleString("en-US")} ◈</span>
          <span>استخر کل {total.toLocaleString("en-US")} ◈</span>
          <span>{pools.down.toLocaleString("en-US")} ◈</span>
        </div>
      </div>

      {/* انتخاب مبلغ */}
      <div className="px-4 mt-4">
        <div className="text-[12px] text-t2 mb-2">مبلغ شرط</div>
        <div className="hscroll flex gap-2">
          {STAKES.map((s) => (
            <Chip key={s} active={s === stake} onClick={() => setStake(s)}>
              <span className="mono">{s}</span> ◈
            </Chip>
          ))}
          <Chip
            active={stake === p.balance}
            onClick={() => setStake(Math.max(50, Math.floor(p.balance)))}
          >
            همه
          </Chip>
        </div>
      </div>

      {/* دکمه‌های اصلی */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <button
          disabled={phase !== "betting" || !!bet}
          onClick={() => place("up")}
          className={`h-[86px] rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all disabled:opacity-40 ${
            bet?.side === "up"
              ? "bg-up/25 border-up"
              : "bg-up/10 border-up/40 active:bg-up/20"
          }`}
        >
          <span className="text-up text-[22px] leading-none">▲</span>
          <span className="text-up font-extrabold text-[17px]">صعود</span>
          <span className="mono text-up/70 text-[12px] font-bold">×{multUp}</span>
        </button>

        <button
          disabled={phase !== "betting" || !!bet}
          onClick={() => place("down")}
          className={`h-[86px] rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all disabled:opacity-40 ${
            bet?.side === "down"
              ? "bg-down/25 border-down"
              : "bg-down/10 border-down/40 active:bg-down/20"
          }`}
        >
          <span className="text-down text-[22px] leading-none">▼</span>
          <span className="text-down font-extrabold text-[17px]">نزول</span>
          <span className="mono text-down/70 text-[12px] font-bold">×{multDown}</span>
        </button>
      </div>

      <div className="px-4 mt-3 text-center text-[12px] text-t3">
        {bet ? (
          <span className="text-t2">
            شرط ثبت شد ·{" "}
            <span className="mono">{bet.stake}</span> ◈ روی{" "}
            <span className={bet.side === "up" ? "text-up" : "text-down"}>
              {bet.side === "up" ? "صعود" : "نزول"}
            </span>
          </span>
        ) : phase === "betting" ? (
          <>هر شرط ۱ انرژی مصرف می‌کند · انرژی شما {p.energy}/{p.energyMax}</>
        ) : (
          "شرط‌گیری بسته است — منتظر نتیجه"
        )}
      </div>

      {/* نتیجه */}
      {outcome && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 px-4 pb-6">
          <Card className="w-full max-w-md p-5 slideup">
            <div className="text-center">
              <div
                className={`text-[44px] leading-none pop ${
                  outcome.won ? "text-up" : "text-down"
                }`}
              >
                {outcome.won ? "🏆" : "✕"}
              </div>
              <div
                className={`text-[24px] font-extrabold mt-2 ${
                  outcome.won ? "text-up" : "text-down"
                }`}
              >
                {outcome.won ? "بردی!" : "باختی"}
              </div>
              {outcome.won && (
                <div className="mono text-brand text-[30px] font-bold mt-1">
                  +{outcome.payout.toLocaleString("en-US")} ◈
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-s2 p-3">
              <div>
                <div className="text-[10px] text-t3">قیمت قفل</div>
                <div className="mono text-[13px] font-bold">
                  {fmtPrice(outcome.lock, asset)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-t3">قیمت بسته</div>
                <div className="mono text-[13px] font-bold">
                  {fmtPrice(outcome.close, asset)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-t3">تغییر</div>
                <div
                  className={`mono text-[13px] font-bold ${
                    outcome.close >= outcome.lock ? "text-up" : "text-down"
                  }`}
                >
                  {outcome.close >= outcome.lock ? "+" : ""}
                  {(outcome.close - outcome.lock).toFixed(2)}
                </div>
              </div>
            </div>

            <Button
              className="w-full mt-4"
              size="lg"
              onClick={() => setOutcome(null)}
            >
              راند بعدی
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
