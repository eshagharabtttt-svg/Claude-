import { useState } from "react";
import { BalancePill, Button } from "../../components/ui";
import { usePlayer } from "../../lib/store";
import { useFullScreen } from "../../lib/chrome";
import { GameHeader } from "./GameHeader";

const SIZE = 5;
const TILES = SIZE * SIZE;
const STAKES = [50, 100, 250, 500];
const MINE_OPTIONS = [1, 3, 5, 10, 24];
const RTP = 0.95;

/**
 * Multiplier after k safe picks.
 *
 * Surviving k picks has probability C(N-M,k)/C(N,k), so the fair payout
 * is its inverse — written here as a running product, which is also how
 * the number climbs on screen tile by tile.
 */
function multAfter(k: number, mines: number) {
  if (k <= 0) return 1;
  let m = RTP;
  for (let i = 0; i < k; i++) {
    m *= (TILES - i) / (TILES - mines - i);
  }
  return m;
}

type Tile = "hidden" | "gem" | "bomb";
type Phase = "idle" | "live" | "bust" | "cashed";

function buzz(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

export function Mines({ onBack }: { onBack: () => void }) {
  useFullScreen();
  const { p, credit } = usePlayer();

  const [mines, setMines] = useState(3);
  const [stake, setStake] = useState(100);
  const [phase, setPhase] = useState<Phase>("idle");
  const [field, setField] = useState<boolean[]>([]); // true = mine
  const [shown, setShown] = useState<Tile[]>(Array(TILES).fill("hidden"));
  const [picks, setPicks] = useState(0);
  const [last, setLast] = useState<{ won: boolean; amount: number } | null>(null);

  const safeTotal = TILES - mines;
  const mult = multAfter(picks, mines);
  const nextMult = multAfter(picks + 1, mines);
  const cashValue = Math.round(stake * mult);

  const start = () => {
    if (p.balance < stake) return;
    credit(-stake, "Mines bet");
    const bombs = new Set<number>();
    while (bombs.size < mines) bombs.add(Math.floor(Math.random() * TILES));
    setField(Array.from({ length: TILES }, (_, i) => bombs.has(i)));
    setShown(Array(TILES).fill("hidden"));
    setPicks(0);
    setLast(null);
    setPhase("live");
    buzz(25);
  };

  const pick = (i: number) => {
    if (phase !== "live" || shown[i] !== "hidden") return;

    if (field[i]) {
      setShown((s) =>
        s.map((t, j) => (field[j] ? "bomb" : t))
      );
      setPhase("bust");
      setLast({ won: false, amount: stake });
      buzz(180);
      return;
    }

    const nextPicks = picks + 1;
    setShown((s) => s.map((t, j) => (j === i ? "gem" : t)));
    setPicks(nextPicks);
    buzz(20);

    // clearing every safe tile pays the top of the table automatically
    if (nextPicks === safeTotal) {
      const amount = Math.round(stake * multAfter(nextPicks, mines));
      credit(amount, `Mines ×${multAfter(nextPicks, mines).toFixed(2)}`);
      setShown((s) => s.map((t, j) => (field[j] ? "bomb" : t === "hidden" ? "gem" : t)));
      setPhase("cashed");
      setLast({ won: true, amount });
      buzz([40, 60, 40, 60, 90]);
    }
  };

  const cashOut = () => {
    if (phase !== "live" || picks === 0) return;
    credit(cashValue, `Mines ×${mult.toFixed(2)}`);
    setShown((s) => s.map((t, j) => (field[j] ? "bomb" : t)));
    setPhase("cashed");
    setLast({ won: true, amount: cashValue });
    buzz([30, 50, 30]);
  };

  const reset = () => {
    setPhase("idle");
    setShown(Array(TILES).fill("hidden"));
    setPicks(0);
  };

  const live = phase === "live";
  const over = phase === "bust" || phase === "cashed";

  return (
    <div className="h-full flex flex-col pb-1">
      <GameHeader title="Mines" onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      {/* readout */}
      <div className="px-3 shrink-0">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Multiplier" value={`${mult.toFixed(2)}×`} accent />
          <Stat
            label={live ? "Next tile" : "Gems found"}
            value={live ? `${nextMult.toFixed(2)}×` : `${picks}`}
          />
          <Stat
            label="Cash out"
            value={picks > 0 ? cashValue.toLocaleString("en-US") : "—"}
          />
        </div>
      </div>

      {/* grid */}
      <div className="flex-1 min-h-[260px] flex items-center justify-center px-4 py-3">
        <div className="w-full max-w-[340px] grid grid-cols-5 gap-2">
          {Array.from({ length: TILES }).map((_, i) => {
            const t = shown[i];
            const clickable = live && t === "hidden";
            return (
              <button
                key={i}
                disabled={!clickable}
                onClick={() => pick(i)}
                className={`aspect-square rounded-xl flex items-center justify-center text-[22px] border transition-all ${
                  t === "gem"
                    ? "bg-up/20 border-up/60 pop"
                    : t === "bomb"
                      ? "bg-down/20 border-down/60 pop"
                      : clickable
                        ? "bg-s2 border-line active:bg-s3 active:scale-95"
                        : "bg-s2/50 border-line/50"
                }`}
              >
                {t === "gem" ? "💎" : t === "bomb" ? "💣" : ""}
              </button>
            );
          })}
        </div>
      </div>

      {/* result */}
      {over && last && (
        <div className="px-4 pb-1 shrink-0 text-center">
          <span
            className={`text-[15px] font-extrabold ${
              last.won ? "text-up" : "text-down"
            }`}
          >
            {last.won
              ? `+${last.amount.toLocaleString("en-US")} ◈ · ${mult.toFixed(2)}×`
              : `−${last.amount.toLocaleString("en-US")} ◈ · hit a mine`}
          </span>
        </div>
      )}

      {/* controls */}
      <div className="px-3 pt-2 shrink-0">
        <div className="rounded-2xl border border-line bg-s1 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-t3 w-10 shrink-0">Mines</span>
            <div className="hscroll flex gap-1.5 flex-1">
              {MINE_OPTIONS.map((m) => (
                <button
                  key={m}
                  disabled={live}
                  onClick={() => setMines(m)}
                  className={`shrink-0 h-8 px-3 rounded-lg text-[12px] font-bold mono disabled:opacity-40 ${
                    mines === m ? "bg-t1 text-bg" : "bg-s2 text-t2"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <span className="mono text-[10px] text-t3 shrink-0">
              {multAfter(1, mines).toFixed(2)}× first
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-t3 w-10 shrink-0">Bet</span>
            <div className="hscroll flex gap-1.5 flex-1">
              {STAKES.map((s) => (
                <button
                  key={s}
                  disabled={live}
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

          {live ? (
            <button
              onClick={cashOut}
              disabled={picks === 0}
              className="w-full h-14 rounded-2xl bg-up text-bg font-extrabold text-[17px] active:brightness-90 disabled:opacity-40 disabled:bg-s3 disabled:text-t3"
            >
              {picks === 0
                ? "Pick a tile to start climbing"
                : `Cash out ${cashValue.toLocaleString("en-US")} ◈`}
            </button>
          ) : (
            <Button
              size="lg"
              className="w-full"
              disabled={p.balance < stake}
              onClick={over ? () => { reset(); start(); } : start}
            >
              {p.balance < stake
                ? "Not enough balance"
                : over
                  ? `Play again · ${stake} ◈`
                  : `Start · ${stake} ◈`}
            </Button>
          )}
        </div>

        <div className="text-center text-[10px] text-t3 pt-2">
          {mines} mine{mines === 1 ? "" : "s"} in {TILES} tiles · RTP{" "}
          {Math.round(RTP * 100)}%
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
