import { useEffect, useRef, useState } from "react";
import { Chart } from "../../components/Chart";
import { BalancePill, Button, Card } from "../../components/ui";
import { fmtPrice, getFeed, type AssetId } from "../../lib/feed";
import { usePlayer } from "../../lib/store";
import { GameHeader } from "./GameHeader";

const FIELD = 50;
const STAKES = [50, 100, 250, 500];
const PICK_MS = 10_000;
const SETTLE_MS = 6_000;
const ASSET: AssetId = "ETH";

type Stage = "lobby" | "pick" | "settle" | "over";
type Side = "up" | "down";

type Rival = { id: number; name: string; alive: boolean; pick: Side | null };

const NAMES = [
  "Sara", "Kian", "MoonBoy", "Reza_TR", "Nima", "Ava", "Parsa", "Yas",
  "DegenX", "Mahdi", "Roya", "BTCmax", "Sina", "Lida", "Arman", "Zed",
];

const rivalName = (i: number) =>
  `${NAMES[i % NAMES.length]}${i >= NAMES.length ? i : ""}`;

function buzz(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

export function Royale({ onBack }: { onBack: () => void }) {
  const { p, credit, recordResult } = usePlayer();
  const [stage, setStage] = useState<Stage>("lobby");
  const [stake, setStake] = useState(100);
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [alive, setAlive] = useState(false);
  const [round, setRound] = useState(0);
  const [pick, setPick] = useState<Side | null>(null);
  const [left, setLeft] = useState(PICK_MS);
  const [price, setPrice] = useState(getFeed(ASSET).price);
  const [lock, setLock] = useState<number | null>(null);
  const [place, setPlace] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const phaseAt = useRef(0);
  const pickRef = useRef<Side | null>(null);
  pickRef.current = pick;
  const aliveRef = useRef(false);
  aliveRef.current = alive;

  useEffect(() => {
    const f = getFeed(ASSET);
    return f.sub((t) => setPrice(t.p));
  }, []);

  const survivors = rivals.filter((r) => r.alive).length + (alive ? 1 : 0);
  const pot = Math.round(FIELD * stake * 0.95);

  const join = () => {
    if (p.balance < stake) return;
    credit(-stake, "Royale entry");
    setRivals(
      Array.from({ length: FIELD - 1 }, (_, i) => ({
        id: i,
        name: rivalName(i),
        alive: true,
        pick: null,
      }))
    );
    setAlive(true);
    setRound(1);
    setPick(null);
    setPlace(0);
    setLog([]);
    setLock(null);
    phaseAt.current = Date.now();
    setStage("pick");
    buzz([40, 60, 40]);
  };

  /* ---- round machine ---- */
  useEffect(() => {
    if (stage !== "pick" && stage !== "settle") return;
    const t = setInterval(() => {
      const elapsed = Date.now() - phaseAt.current;
      const span = stage === "pick" ? PICK_MS : SETTLE_MS;
      setLeft(Math.max(0, span - elapsed));
      if (elapsed < span) return;

      if (stage === "pick") {
        setLock(getFeed(ASSET).price);
        // rivals commit blind, with a small spread in judgement
        setRivals((rs) =>
          rs.map((r) =>
            r.alive
              ? { ...r, pick: Math.random() > 0.5 ? "up" : "down" }
              : r
          )
        );
        phaseAt.current = Date.now();
        setStage("settle");
        return;
      }

      // settle
      const close = getFeed(ASSET).price;
      const lockPrice = lock ?? close;
      const winner: Side = close >= lockPrice ? "up" : "down";

      setRivals((rs) => {
        const alivePicks = rs.filter((r) => r.alive);
        const wouldSurvive = alivePicks.filter((r) => r.pick === winner).length;
        const meSurvives = aliveRef.current && pickRef.current === winner;

        // A round that would wipe the entire field is void — nobody is out.
        const wipeout = wouldSurvive === 0 && !meSurvives;
        if (wipeout) {
          setLog((l) => [`Round ${round}: void — everyone survived`, ...l]);
          return rs.map((r) => ({ ...r, pick: null }));
        }

        const next = rs.map((r) =>
          r.alive && r.pick !== winner
            ? { ...r, alive: false, pick: null }
            : { ...r, pick: null }
        );

        const out = rs.filter((r) => r.alive).length - next.filter((r) => r.alive).length;
        setLog((l) => [
          `Round ${round}: ${winner === "up" ? "▲ UP" : "▼ DOWN"} · ${out} eliminated`,
          ...l,
        ]);

        if (aliveRef.current && !meSurvives) {
          const remaining = next.filter((r) => r.alive).length;
          setAlive(false);
          setPlace(remaining + 1);
          recordResult(false, -10);
          buzz(160);
        }
        return next;
      });

      setPick(null);
      setLock(null);
      setRound((r) => r + 1);
      phaseAt.current = Date.now();
      setStage("pick");
    }, 150);
    return () => clearInterval(t);
  }, [stage, lock, round, recordResult]);

  /* ---- end conditions ---- */
  useEffect(() => {
    if (stage !== "pick" && stage !== "settle") return;
    const remaining = rivals.filter((r) => r.alive).length;

    if (alive && remaining === 0 && rivals.length > 0) {
      credit(pot, "Royale win");
      recordResult(true, 120);
      setPlace(1);
      setStage("over");
      buzz([50, 70, 50, 70, 110]);
      return;
    }
    if (!alive && place > 0) {
      // fast-forward the rest of the field so the result is immediate
      if (remaining > 1) {
        setRivals((rs) => {
          const survivors = rs.filter((r) => r.alive);
          const champ = survivors[Math.floor(Math.random() * survivors.length)];
          return rs.map((r) => ({ ...r, alive: r.id === champ.id }));
        });
        return;
      }
      setStage("over");
    }
  }, [rivals, alive, place, stage, pot, credit, recordResult]);

  /* ---------------- lobby ---------------- */
  if (stage === "lobby") {
    return (
      <div className="vscroll h-full pb-28">
        <GameHeader title="Battle Royale" onBack={onBack}>
          <BalancePill value={p.balance} />
        </GameHeader>

        <div className="px-4 space-y-4">
          <Card className="p-5 text-center">
            <div className="text-[40px] leading-none">🏹</div>
            <div className="text-[20px] font-extrabold mt-2">
              {FIELD} in. 1 out.
            </div>
            <div className="text-[13px] text-t2 mt-1.5 leading-relaxed">
              Every round the field calls UP or DOWN. Everyone on the wrong
              side is eliminated. Last player standing takes the pot.
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-[12px] text-t2 mb-2">Entry</div>
            <div className="hscroll flex gap-2">
              {STAKES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStake(s)}
                  className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-bold ${
                    s === stake
                      ? "bg-t1 text-bg"
                      : "bg-s2 text-t2 border border-line"
                  }`}
                >
                  <span className="mono">{s}</span> ◈
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-4 rounded-xl bg-s2 p-3">
              <span className="text-[12px] text-t2">Winner takes</span>
              <span className="mono text-[16px] font-bold text-brand">
                {Math.round(FIELD * stake * 0.95).toLocaleString("en-US")} ◈
              </span>
            </div>
          </Card>

          <Button
            size="lg"
            className="w-full"
            disabled={p.balance < stake}
            onClick={join}
          >
            {p.balance < stake ? "Not enough balance" : `Join · ${stake} ◈`}
          </Button>
        </div>
      </div>
    );
  }

  /* ---------------- result ---------------- */
  if (stage === "over") {
    const won = place === 1;
    return (
      <div className="vscroll h-full pb-28">
        <GameHeader title="Battle Royale" onBack={onBack}>
          <BalancePill value={p.balance} />
        </GameHeader>
        <div className="px-4 space-y-3">
          <Card className="p-6 text-center slideup">
            <div className="text-[46px] leading-none pop">
              {won ? "👑" : "💀"}
            </div>
            <div
              className={`text-[24px] font-extrabold mt-2 ${
                won ? "text-up" : "text-down"
              }`}
            >
              {won ? "Last one standing" : `Placed #${place}`}
            </div>
            {won ? (
              <div className="mono text-brand text-[28px] font-bold mt-1">
                +{pot.toLocaleString("en-US")} ◈
              </div>
            ) : (
              <div className="text-[13px] text-t2 mt-1">
                out of {FIELD} · survived {round - 1} rounds
              </div>
            )}
          </Card>
          <Button size="lg" className="w-full" onClick={() => setStage("lobby")}>
            Play again
          </Button>
        </div>
      </div>
    );
  }

  /* ---------------- arena ---------------- */
  const delta = lock ? price - lock : 0;

  return (
    <div className="h-full flex flex-col pb-[68px]">
      <GameHeader title={`Round ${round}`} onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      <div className="px-4 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-t3">Survivors</div>
            <div className="mono text-[30px] font-extrabold leading-none">
              {survivors}
              <span className="text-t3 text-[16px]">/{FIELD}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-t3">Pot</div>
            <div className="mono text-[18px] font-bold text-brand">
              {pot.toLocaleString("en-US")} ◈
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-t3">
              {stage === "pick" ? "Pick in" : "Result in"}
            </div>
            <div
              className={`mono text-[30px] font-bold leading-none ${
                stage === "pick"
                  ? left < 3000
                    ? "text-down"
                    : "text-brand"
                  : "text-warn"
              }`}
            >
              {(left / 1000).toFixed(0)}
            </div>
          </div>
        </div>

        <div className="h-1.5 rounded-full bg-s2 overflow-hidden mt-2">
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: `${(survivors / FIELD) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-[150px]">
        <Chart
          asset={ASSET}
          lines={
            lock
              ? [{ price: lock, color: "#8a8a93", title: "LOCK", dashed: true }]
              : []
          }
          tone={lock ? (delta >= 0 ? "up" : "down") : "brand"}
        />
      </div>

      {/* field */}
      <div className="px-4 pt-2 shrink-0">
        <div className="flex flex-wrap gap-1">
          {alive && (
            <span className="h-5 px-1.5 rounded bg-brand text-bg text-[9px] font-extrabold flex items-center">
              YOU
            </span>
          )}
          {rivals.slice(0, 40).map((r) => (
            <span
              key={r.id}
              className={`h-5 w-5 rounded text-[9px] font-bold flex items-center justify-center ${
                r.alive ? "bg-s3 text-t2" : "bg-s2 text-t3/30 line-through"
              }`}
            >
              {r.name[0]}
            </span>
          ))}
        </div>
        {log[0] && (
          <div className="mono text-[10px] text-t3 mt-2 truncate">{log[0]}</div>
        )}
      </div>

      {/* actions */}
      <div className="px-4 pt-3 shrink-0">
        {!alive ? (
          <Card className="p-3 text-center">
            <span className="text-[13px] text-down font-bold">
              Eliminated · watching the finish
            </span>
          </Card>
        ) : stage === "settle" ? (
          <Card className="p-3 text-center">
            <span className="text-[13px] text-t2">
              Locked at <span className="mono">{fmtPrice(lock ?? 0, ASSET)}</span>{" "}
              · you called{" "}
              <span className={pick === "up" ? "text-up" : "text-down"}>
                {pick === "up" ? "UP" : pick === "down" ? "DOWN" : "nothing"}
              </span>
            </span>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPick("up")}
              className={`h-[56px] rounded-2xl font-extrabold text-[16px] border ${
                pick === "up"
                  ? "bg-up text-bg border-up"
                  : "bg-up/15 text-up border-up/40 active:bg-up/30"
              }`}
            >
              ↑ UP
            </button>
            <button
              onClick={() => setPick("down")}
              className={`h-[56px] rounded-2xl font-extrabold text-[16px] border ${
                pick === "down"
                  ? "bg-down text-bg border-down"
                  : "bg-down/15 text-down border-down/40 active:bg-down/30"
              }`}
            >
              ↓ DOWN
            </button>
          </div>
        )}
        {alive && stage === "pick" && !pick && (
          <p className="text-center text-[11px] text-down mt-2">
            No pick means elimination
          </p>
        )}
      </div>
    </div>
  );
}
