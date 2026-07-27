import { useEffect, useRef, useState } from "react";
import { Chart, type Marker } from "../components/Chart";
import { BalancePill, Button, Card, Chip } from "../components/ui";
import { fmtPrice, getFeed, mmss, type AssetId } from "../lib/feed";
import { accuracy, usePlayer } from "../lib/store";
import { useChrome } from "../lib/chrome";

const ASSETS: AssetId[] = ["ETH", "BTC", "TON", "SOL"];
const STAKES = [100, 250, 500, 1000];

const DUEL_LEN = 90_000;
const SHOT_WINDOW = 15_000;
const SHOTS = 3;

type Stage = "lobby" | "searching" | "arena" | "result";
type Side = "up" | "down";

type Shot = {
  id: number;
  side: Side;
  firedAt: number;
  lock: number;
  close?: number;
  points?: number;
};

const OPPONENTS = [
  { name: "Reza_TR", acc: 58, elo: 1204 },
  { name: "Kian", acc: 61, elo: 1250 },
  { name: "MoonBoy", acc: 54, elo: 1132 },
  { name: "Sara", acc: 63, elo: 1288 },
];

function buzz(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* noop */
    }
  }
}

function scoreOf(shots: Shot[]) {
  return shots.reduce((a, s) => a + (s.points ?? 0), 0);
}

export function Duel() {
  const { p, credit, recordResult } = usePlayer();
  const [stage, setStage] = useState<Stage>("lobby");
  const [asset, setAsset] = useState<AssetId>("ETH");
  const [stake, setStake] = useState(250);
  const [opp, setOpp] = useState(OPPONENTS[0]);
  const [left, setLeft] = useState(DUEL_LEN);
  const [mine, setMine] = useState<Shot[]>([]);
  const [theirs, setTheirs] = useState<Shot[]>([]);
  const [price, setPrice] = useState(getFeed("ETH").price);

  const { setNavHidden } = useChrome();
  useEffect(() => {
    setNavHidden(stage !== "lobby");
    return () => setNavHidden(false);
  }, [stage, setNavHidden]);

  const startAt = useRef(0);
  const botPlan = useRef<number[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const f = getFeed(asset);
    setPrice(f.price);
    return f.sub((t) => setPrice(t.p));
  }, [asset]);

  const begin = () => {
    setStage("searching");
    setOpp(OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)]);
    setTimeout(() => {
      credit(-stake, "Duel entry");
      startAt.current = Date.now();
      botPlan.current = Array.from({ length: SHOTS }, () =>
        Math.round(3000 + Math.random() * (DUEL_LEN - SHOT_WINDOW - 6000))
      ).sort((a, b) => a - b);
      setMine([]);
      setTheirs([]);
      setLeft(DUEL_LEN);
      setStage("arena");
      buzz([40, 80, 40]);
    }, 1600);
  };

  // main duel loop
  useEffect(() => {
    if (stage !== "arena") return;
    const t = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startAt.current;
      setLeft(Math.max(0, DUEL_LEN - elapsed));

      const resolve = (list: Shot[]) =>
        list.map((s) => {
          if (s.close !== undefined) return s;
          if (now - s.firedAt < SHOT_WINDOW) return s;
          const close = getFeed(asset).price;
          const dir = s.side === "up" ? 1 : -1;
          const pts = Math.round(((close - s.lock) / s.lock) * 10000 * dir);
          return { ...s, close, points: pts };
        });

      setMine((m) => resolve(m));
      setTheirs((o) => {
        const next = resolve(o);
        // bot fires on schedule
        if (botPlan.current.length && elapsed >= botPlan.current[0]) {
          botPlan.current.shift();
          next.push({
            id: ++seq.current,
            side: Math.random() > 0.5 ? "up" : "down",
            firedAt: now,
            lock: getFeed(asset).price,
          });
        }
        return next;
      });

      if (elapsed >= DUEL_LEN + SHOT_WINDOW) setStage("result");
    }, 250);
    return () => clearInterval(t);
  }, [stage, asset]);

  // duel settlement
  const settled = useRef(false);
  useEffect(() => {
    if (stage !== "result" || settled.current) return;
    settled.current = true;
    const my = scoreOf(mine);
    const th = scoreOf(theirs);
    const won = my > th;
    if (won) credit(stake * 2, "Duel win");
    recordResult(won, won ? 60 : -15);
    buzz(won ? [40, 60, 40, 60, 80] : 150);
  }, [stage, mine, theirs, stake, credit, recordResult]);

  const fire = (side: Side) => {
    if (stage !== "arena") return;
    if (mine.length >= SHOTS) return;
    if (Date.now() - startAt.current > DUEL_LEN - SHOT_WINDOW) return;
    setMine((m) => [
      ...m,
      { id: ++seq.current, side, firedAt: Date.now(), lock: getFeed(asset).price },
    ]);
    buzz(35);
  };

  const myScore = scoreOf(mine);
  const thScore = scoreOf(theirs);
  const canFire =
    stage === "arena" &&
    mine.length < SHOTS &&
    Date.now() - startAt.current <= DUEL_LEN - SHOT_WINDOW;

  /* ---------------- lobby ---------------- */
  if (stage === "lobby" || stage === "searching") {
    return (
      <div className="vscroll h-full pb-28">
        <header className="flex items-center justify-between px-4 pt-4 pb-4">
          <div>
            <h1 className="text-[26px] font-extrabold leading-tight">Duel</h1>
            <p className="text-t3 text-xs mt-0.5">
              Head to head with a real player — winner takes all
            </p>
          </div>
          <BalancePill value={p.balance} />
        </header>

        {stage === "searching" ? (
          <div className="px-4">
            <Card className="p-8 text-center">
              <div className="mx-auto h-20 w-20 rounded-full border-4 border-brand/30 border-t-brand animate-spin" />
              <div className="mt-5 text-[17px] font-bold">Finding an opponent…</div>
              <div className="text-t3 text-[12px] mt-1 mono">
                Elo {p.elo} ± 120
              </div>
            </Card>
          </div>
        ) : (
          <div className="px-4 space-y-4">
            <Card className="p-4">
              <div className="text-[12px] text-t2 mb-2">Asset</div>
              <div className="hscroll flex gap-2">
                {ASSETS.map((a) => (
                  <Chip key={a} active={a === asset} onClick={() => setAsset(a)}>
                    {a}
                  </Chip>
                ))}
              </div>

              <div className="text-[12px] text-t2 mt-4 mb-2">Entry stake</div>
              <div className="hscroll flex gap-2">
                {STAKES.map((s) => (
                  <Chip key={s} active={s === stake} onClick={() => setStake(s)}>
                    <span className="mono">{s}</span> ◈
                  </Chip>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-[13px] font-bold mb-3">How a duel works</div>
              <ul className="space-y-2 text-[12px] text-t2">
                <li className="flex gap-2">
                  <span className="text-brand">◆</span> 90 seconds long
                </li>
                <li className="flex gap-2">
                  <span className="text-brand">◆</span> {SHOTS} shots each — you
                  pick the moment to fire
                </li>
                <li className="flex gap-2">
                  <span className="text-brand">◆</span> every shot settles 15
                  seconds after firing
                </li>
                <li className="flex gap-2">
                  <span className="text-brand">◆</span> score is the size of the
                  correct move, not just a win
                </li>
                <li className="flex gap-2">
                  <span className="text-brand">◆</span> your opponent's shots stay
                  hidden until they lock
                </li>
              </ul>
            </Card>

            <Button
              size="lg"
              className="w-full"
              disabled={p.balance < stake}
              onClick={begin}
            >
              {p.balance < stake ? "Not enough balance" : "Find opponent"}
            </Button>

            <Button size="lg" variant="surface" className="w-full">
              Invite a friend from Telegram
            </Button>
          </div>
        )}
      </div>
    );
  }

  /* ---------------- result ---------------- */
  if (stage === "result") {
    const won = myScore > thScore;
    return (
      <div className="vscroll h-full pb-28 px-4 pt-6">
        <Card className="p-6 text-center slideup">
          <div className={`text-[52px] leading-none pop`}>{won ? "🏆" : "💀"}</div>
          <div
            className={`text-[26px] font-extrabold mt-2 ${
              won ? "text-up" : "text-down"
            }`}
          >
            {won ? "You won!" : "You lost"}
          </div>
          {won && (
            <div className="mono text-brand text-[30px] font-bold mt-1">
              +{(stake * 2).toLocaleString("en-US")} ◈
            </div>
          )}

          <div className="flex items-center justify-center gap-6 mt-6">
            <div>
              <div className="text-[11px] text-t3">You</div>
              <div className={`mono text-[28px] font-bold ${won ? "text-up" : ""}`}>
                {myScore}
              </div>
            </div>
            <div className="text-t3 text-xl">–</div>
            <div>
              <div className="text-[11px] text-t3">{opp.name}</div>
              <div className={`mono text-[28px] font-bold ${!won ? "text-down" : ""}`}>
                {thScore}
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-4 space-y-2">
          {mine.map((s, i) => (
            <Card key={s.id} className="p-3 flex items-center gap-3">
              <span className="text-[11px] text-t3 w-12">Shot {i + 1}</span>
              <span
                className={`text-[13px] font-bold ${
                  s.side === "up" ? "text-up" : "text-down"
                }`}
              >
                {s.side === "up" ? "▲ UP" : "▼ DOWN"}
              </span>
              <span className="mono text-[11px] text-t3 flex-1">
                {fmtPrice(s.lock, asset)} → {s.close ? fmtPrice(s.close, asset) : "—"}
              </span>
              <span
                className={`mono text-[15px] font-bold ${
                  (s.points ?? 0) >= 0 ? "text-up" : "text-down"
                }`}
              >
                {(s.points ?? 0) >= 0 ? "+" : ""}
                {s.points ?? 0}
              </span>
            </Card>
          ))}
        </div>

        <Button size="lg" variant="surface" className="w-full mt-4">
          Share result
        </Button>
        <Button
          size="lg"
          className="w-full mt-2"
          onClick={() => {
            settled.current = false;
            setStage("lobby");
          }}
        >
          Rematch
        </Button>
      </div>
    );
  }

  /* ---------------- arena ---------------- */
  const lines: Marker[] = mine
    .filter((s) => s.close === undefined)
    .map((s) => ({
      price: s.lock,
      color: s.side === "up" ? "#16c784" : "#f0616d",
      title: s.side === "up" ? "\u25b2" : "\u25bc",
      dashed: true,
    }));

  const tone =
    myScore === thScore ? "brand" : myScore > thScore ? "up" : "down";

  return (
    <div className="h-full flex flex-col pb-1">
      {/* score bar */}
      <div className="px-4 pt-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-brand/20 border border-brand/40 flex items-center justify-center text-[10px] font-extrabold text-brand">
              YOU
            </div>
            <div>
              <div className="text-[12px] font-bold">You</div>
              <div className="mono text-[10px] text-t3">{accuracy(p)}% acc</div>
            </div>
          </div>

          <div className="text-center">
            <div className="mono text-[26px] font-extrabold leading-none">
              <span className={myScore >= thScore ? "text-up" : "text-t1"}>
                {myScore}
              </span>
              <span className="text-t3 mx-1.5">:</span>
              <span className={thScore > myScore ? "text-down" : "text-t1"}>
                {thScore}
              </span>
            </div>
            <div
              className={`mono text-[12px] mt-1 font-bold ${
                left <= 10_000 ? "text-down" : "text-t3"
              }`}
            >
              {mmss(left)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[12px] font-bold">{opp.name}</div>
              <div className="mono text-[10px] text-t3">{opp.acc}% acc</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-s3 border border-line flex items-center justify-center text-[13px] font-bold">
              {opp.name[0]}
            </div>
          </div>
        </div>
      </div>

      {/* price */}
      <div className="flex items-baseline justify-between px-4 pt-3 shrink-0">
        <span className="text-[12px] font-bold text-t2">{asset}/USDT</span>
        <span className="mono text-[26px] font-bold">
          {fmtPrice(price, asset)}
        </span>
      </div>

      {/* chart takes the rest */}
      <div className="flex-1 min-h-[200px]">
        <Chart asset={asset} lines={lines} tone={tone} />
      </div>

      {/* shots */}
      <div className="px-4 pt-3 grid grid-cols-2 gap-3 shrink-0">
        <ShotColumn title="Your shots" shots={mine} asset={asset} own />
        <ShotColumn title={`${opp.name}\u2019s shots`} shots={theirs} asset={asset} />
      </div>

      {/* fire buttons */}
      <div className="px-4 pt-3 grid grid-cols-2 gap-3 shrink-0">
        <button
          disabled={!canFire}
          onClick={() => fire("up")}
          className="h-[62px] rounded-2xl border border-up/40 bg-up/15 text-up active:bg-up/30 disabled:opacity-30 flex items-center justify-center gap-2 font-extrabold text-[16px]"
        >
          <span className="text-[18px]">↑</span> FIRE UP
        </button>
        <button
          disabled={!canFire}
          onClick={() => fire("down")}
          className="h-[62px] rounded-2xl border border-down/40 bg-down/15 text-down active:bg-down/30 disabled:opacity-30 flex items-center justify-center gap-2 font-extrabold text-[16px]"
        >
          <span className="text-[18px]">↓</span> FIRE DOWN
        </button>
      </div>

      <div className="text-center text-[11px] text-t3 pt-2 pb-1 shrink-0">
        {mine.length >= SHOTS
          ? "Out of shots — waiting for settlement"
          : `${SHOTS - mine.length} shots left · 15s each`}
      </div>
    </div>
  );
}

function ShotColumn({
  title,
  shots,
  asset,
  own,
}: {
  title: string;
  shots: Shot[];
  asset: AssetId;
  own?: boolean;
}) {
  return (
    <Card className="p-2.5">
      <div className="text-[10px] text-t3 mb-1.5 truncate">{title}</div>
      <div className="space-y-1">
        {Array.from({ length: SHOTS }).map((_, i) => {
          const s = shots[i];
          if (!s)
            return (
              <div
                key={i}
                className="h-7 rounded-lg border border-dashed border-line"
              />
            );
          const pending = s.close === undefined;
          return (
            <div
              key={s.id}
              className={`h-7 rounded-lg px-2 flex items-center justify-between ${
                pending ? "bg-s2" : (s.points ?? 0) >= 0 ? "bg-up/12" : "bg-down/12"
              }`}
            >
              <span
                className={`text-[12px] font-bold ${
                  s.side === "up" ? "text-up" : "text-down"
                }`}
              >
                {s.side === "up" ? "▲" : "▼"}
              </span>
              <span className="mono text-[10px] text-t3">
                {fmtPrice(s.lock, asset)}
              </span>
              <span
                className={`mono text-[12px] font-bold ${
                  pending
                    ? "text-warn"
                    : (s.points ?? 0) >= 0
                      ? "text-up"
                      : "text-down"
                }`}
              >
                {pending
                  ? own
                    ? "…"
                    : "?"
                  : `${(s.points ?? 0) >= 0 ? "+" : ""}${s.points}`}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
