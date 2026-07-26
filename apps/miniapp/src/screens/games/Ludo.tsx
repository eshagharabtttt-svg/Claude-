import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BalancePill, Button, Card } from "../../components/ui";
import { usePlayer } from "../../lib/store";
import { useFullScreen } from "../../lib/chrome";
import { GameHeader } from "./GameHeader";
import {
  applyMove,
  botChoose,
  cellOf,
  COLORS,
  HOME_PATH,
  isHome,
  legalMoves,
  NAMES,
  newBoard,
  PLAYERS,
  RING,
  rollDie,
  SAFE,
  START,
  TOKENS,
  YARD,
  type Board,
  type Player,
} from "../../lib/ludo";

const STAKES = [50, 100, 250, 500];
const GRID = 15;
const BOT_MS = 800;
const MOVE_MS = 420;

type Phase = "lobby" | "roll" | "pick" | "moving" | "over";

function buzz(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

export function Ludo({ onBack }: { onBack: () => void }) {
  useFullScreen();
  const { p, credit, recordResult } = usePlayer();

  const [phase, setPhase] = useState<Phase>("lobby");
  const [stake, setStake] = useState(100);
  const [board, setBoard] = useState<Board>(newBoard);
  const [turn, setTurn] = useState<Player>(0);
  const [die, setDie] = useState(6);
  const [rolling, setRolling] = useState(false);
  const [options, setOptions] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [winner, setWinner] = useState<Player | null>(null);
  const [sixes, setSixes] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  /* ---------- board painting ---------- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  /**
   * A callback ref, not useRef + useEffect: the board only exists once
   * the game leaves the lobby, and an effect that ran on mount would
   * measure a node that was not there yet.
   */
  const boxRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const measure = () =>
      setSize(Math.min(el.clientWidth, el.clientHeight));
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(el);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || size <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * dpr;
    cv.style.width = `${size}px`;
    cv.style.height = `${size}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const u = size / GRID;

    ctx.fillStyle = "#0d0d10";
    ctx.fillRect(0, 0, size, size);

    const box = (r: number, c: number, fill: string, stroke = "#1d1d22") => {
      ctx.fillStyle = fill;
      ctx.fillRect(c * u, r * u, u, u);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(c * u + 0.5, r * u + 0.5, u - 1, u - 1);
    };

    // yards
    const yardBox = (r0: number, c0: number, color: string) => {
      ctx.fillStyle = `${color}22`;
      ctx.fillRect(c0 * u, r0 * u, 6 * u, 6 * u);
      ctx.strokeStyle = `${color}66`;
      ctx.lineWidth = 2;
      ctx.strokeRect(c0 * u + 1, r0 * u + 1, 6 * u - 2, 6 * u - 2);
      ctx.fillStyle = "#0d0d10";
      ctx.fillRect((c0 + 1) * u, (r0 + 1) * u, 4 * u, 4 * u);
    };
    yardBox(0, 0, COLORS[0]);
    yardBox(0, 9, COLORS[1]);
    yardBox(9, 9, COLORS[2]);
    yardBox(9, 0, COLORS[3]);

    // yard slots
    for (const pl of PLAYERS) {
      for (const cell of YARD[pl]) {
        ctx.beginPath();
        ctx.arc((cell.c + 0.5) * u, (cell.r + 0.5) * u, u * 0.36, 0, Math.PI * 2);
        ctx.strokeStyle = `${COLORS[pl]}88`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // ring
    RING.forEach((cell, i) => {
      const owner = PLAYERS.find((pl) => START[pl] === i);
      box(cell.r, cell.c, owner !== undefined ? `${COLORS[owner]}cc` : "#1a1a1f");
      if (SAFE.has(i) && owner === undefined) {
        ctx.fillStyle = "#3f3f47";
        ctx.beginPath();
        ctx.arc((cell.c + 0.5) * u, (cell.r + 0.5) * u, u * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // home columns
    for (const pl of PLAYERS) {
      HOME_PATH[pl].forEach((cell) => box(cell.r, cell.c, `${COLORS[pl]}77`));
    }

    // centre
    const cx = 7.5 * u;
    const cy = 7.5 * u;
    const tri = (a: [number, number], b2: [number, number], color: string) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(a[0], a[1]);
      ctx.lineTo(b2[0], b2[1]);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    const L = 6 * u;
    const R = 9 * u;
    tri([L, L], [L, R], COLORS[0]);
    tri([L, L], [R, L], COLORS[1]);
    tri([R, L], [R, R], COLORS[2]);
    tri([L, R], [R, R], COLORS[3]);
  }, [size]);

  /* ---------- flow ---------- */

  const unit = size / GRID;

  const start = () => {
    if (p.balance < stake) return;
    credit(-stake, "Ludo entry");
    setBoard(newBoard());
    setTurn(0);
    setWinner(null);
    setSixes(0);
    setOptions([]);
    setNote("Your roll");
    setPhase("roll");
    buzz(30);
  };

  const finishTurn = useCallback((again: boolean, from: Player) => {
    if (again && sixes < 2) {
      setSixes((s) => s + 1);
      setTurn(from);
      setNote(from === 0 ? "Another roll" : `${NAMES[from]} rolls again`);
      setPhase("roll");
      return;
    }
    setSixes(0);
    const nx = ((from + 1) % 4) as Player;
    setTurn(nx);
    setNote(nx === 0 ? "Your roll" : `${NAMES[nx]}'s turn`);
    setPhase("roll");
  }, [sixes]);

  const doMove = useCallback(
    (pl: Player, token: number, roll: number) => {
      setPhase("moving");
      const res = applyMove(board, pl, token, roll);
      setBoard(res.board);
      if (res.captured.length) {
        setNote(
          `${NAMES[pl]} sends ${NAMES[res.captured[0].player]} home`
        );
        buzz(pl === 0 ? [30, 60, 30] : 120);
      }
      const t = setTimeout(() => {
        if (res.finished) {
          setWinner(pl);
          setPhase("over");
          const won = pl === 0;
          if (won) credit(Math.round(stake * 3.8), "Ludo win");
          recordResult(won, won ? 100 : -20);
          buzz(won ? [40, 60, 40, 60, 90] : 160);
          return;
        }
        finishTurn(res.again, pl);
      }, MOVE_MS);
      timers.current.push(t);
    },
    [board, stake, credit, recordResult, finishTurn]
  );

  const roll = useCallback(
    (pl: Player) => {
      setRolling(true);
      let ticks = 0;
      const spin = setInterval(() => {
        setDie(rollDie());
        if (++ticks >= 8) {
          clearInterval(spin);
          const value = rollDie();
          setDie(value);
          setRolling(false);
          const opts = legalMoves(board, pl, value);
          if (!opts.length) {
            setNote(`${NAMES[pl]} rolled ${value} — no move`);
            const t = setTimeout(() => finishTurn(value === 6, pl), 700);
            timers.current.push(t);
            return;
          }
          if (pl === 0) {
            setOptions(opts);
            setNote(opts.length === 1 ? "One move available" : "Pick a piece");
            setPhase("pick");
            if (opts.length === 1) {
              const t = setTimeout(() => doMove(0, opts[0], value), 450);
              timers.current.push(t);
            }
          } else {
            const pick = botChoose(board, pl, value, opts);
            const t = setTimeout(() => doMove(pl, pick, value), 500);
            timers.current.push(t);
          }
        }
      }, 55);
      timers.current.push(spin as unknown as ReturnType<typeof setTimeout>);
    },
    [board, doMove, finishTurn]
  );

  // bots roll on their own
  useEffect(() => {
    if (phase !== "roll" || turn === 0) return;
    const t = setTimeout(() => roll(turn), BOT_MS);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [phase, turn, roll]);

  /* ---------- token layout ---------- */

  type Piece = {
    key: string;
    pl: Player;
    idx: number;
    x: number;
    y: number;
    movable: boolean;
  };

  const pieces = useMemo<Piece[]>(() => {
    if (!unit) return [];
    const bucket = new Map<string, number>();
    const out: Piece[] = [];

    for (const pl of PLAYERS) {
      board[pl].forEach((t, idx) => {
        const cell = cellOf(pl, t.steps, idx);
        const key = `${cell.r},${cell.c}`;
        const n = bucket.get(key) ?? 0;
        bucket.set(key, n + 1);
        // stack shared squares so both pieces stay visible
        const off = t.steps < 0 ? 0 : n * unit * 0.16;
        out.push({
          key: `${pl}-${idx}`,
          pl,
          idx,
          x: (cell.c + 0.5) * unit + off,
          y: (cell.r + 0.5) * unit - off,
          movable: pl === 0 && phase === "pick" && options.includes(idx),
        });
      });
    }
    return out;
  }, [board, unit, phase, options]);

  const homeCount = (pl: Player) => board[pl].filter(isHome).length;

  /* ---------- lobby ---------- */

  if (phase === "lobby") {
    return (
      <div className="vscroll h-full pb-6">
        <GameHeader title="Ludo" onBack={onBack}>
          <BalancePill value={p.balance} />
        </GameHeader>

        <div className="px-4 space-y-4">
          <Card className="p-5 text-center">
            <div className="text-[40px] leading-none">🎯</div>
            <div className="text-[20px] font-extrabold mt-2">
              Four pieces, one way home
            </div>
            <div className="text-[13px] text-t2 mt-1.5 leading-relaxed">
              A six lets a piece out. Walk the ring, turn up your own column,
              and land on the last square exactly. Land on somebody and they
              start over — unless they are on a marked square.
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
              <span className="text-[12px] text-t2">Win pays</span>
              <span className="mono text-[16px] font-bold text-brand">
                {Math.round(stake * 3.8).toLocaleString("en-US")} ◈
              </span>
            </div>
          </Card>

          <Button
            size="lg"
            className="w-full"
            disabled={p.balance < stake}
            onClick={start}
          >
            {p.balance < stake ? "Not enough balance" : `Play · ${stake} ◈`}
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- table ---------- */

  return (
    <div className="h-full flex flex-col pb-1">
      <GameHeader title="Ludo" onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      {/* players */}
      <div className="grid grid-cols-4 gap-1.5 px-3 pb-2 shrink-0">
        {PLAYERS.map((pl) => (
          <div
            key={pl}
            className={`rounded-lg border px-2 py-1.5 text-center transition-colors ${
              turn === pl ? "bg-s3 border-brand/60" : "bg-s1 border-line"
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: COLORS[pl] }}
              />
              <span className="text-[10px] font-bold">{NAMES[pl]}</span>
            </div>
            <div className="mono text-[11px] text-t2 mt-0.5">
              {homeCount(pl)}/{TOKENS}
            </div>
          </div>
        ))}
      </div>

      {/* board */}
      <div ref={boxRef} className="flex-1 min-h-[280px] relative flex items-center justify-center px-2">
        <div className="relative" style={{ width: size, height: size }}>
          <canvas ref={canvasRef} className="block rounded-lg" />

          {pieces.map((pc) => (
            <button
              key={pc.key}
              disabled={!pc.movable}
              onClick={() => doMove(0, pc.idx, die)}
              className="absolute rounded-full border-2 transition-all duration-300"
              style={{
                width: unit * 0.68,
                height: unit * 0.68,
                left: pc.x,
                top: pc.y,
                transform: "translate(-50%, -50%)",
                background: COLORS[pc.pl],
                borderColor: pc.movable ? "#ffffff" : "rgba(0,0,0,.55)",
                boxShadow: pc.movable
                  ? "0 0 0 3px rgba(255,255,255,.35), 0 3px 8px rgba(0,0,0,.5)"
                  : "0 2px 5px rgba(0,0,0,.5)",
                zIndex: pc.movable ? 20 : 10,
              }}
            />
          ))}
        </div>
      </div>

      {/* dice + status */}
      <div className="px-3 pt-2 shrink-0">
        <div className="rounded-2xl border border-line bg-s1 p-3 flex items-center gap-3">
          <Die value={die} rolling={rolling} active={turn === 0} />

          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold truncate">{note}</div>
            <div className="text-[10px] text-t3 mt-0.5">
              {turn === 0
                ? phase === "pick"
                  ? "Tap a highlighted piece"
                  : "Your turn"
                : `${NAMES[turn]} is playing`}
            </div>
          </div>

          <Button
            size="md"
            disabled={turn !== 0 || phase !== "roll" || rolling}
            onClick={() => roll(0)}
          >
            Roll
          </Button>
        </div>
      </div>

      {/* result */}
      {phase === "over" && winner !== null && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 px-4 pb-6">
          <Card className="w-full max-w-md p-5 slideup text-center">
            <div className="text-[42px] leading-none pop">
              {winner === 0 ? "🏆" : "😔"}
            </div>
            <div className="text-[20px] font-extrabold mt-2">
              {winner === 0 ? "You got all four home" : `${NAMES[winner]} wins`}
            </div>
            {winner === 0 && (
              <div className="mono text-brand text-[24px] font-bold mt-1">
                +{Math.round(stake * 3.8).toLocaleString("en-US")} ◈
              </div>
            )}
            <Button
              size="lg"
              className="w-full mt-4"
              onClick={() => setPhase("lobby")}
            >
              Play again
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Die face drawn from pip positions rather than a glyph, so it scales cleanly */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function Die({
  value,
  rolling,
  active,
}: {
  value: number;
  rolling: boolean;
  active: boolean;
}) {
  return (
    <div
      className={`h-14 w-14 rounded-xl grid grid-cols-3 grid-rows-3 gap-0.5 p-2 shrink-0 transition-transform ${
        rolling ? "animate-pulse scale-95" : ""
      }`}
      style={{
        background: "linear-gradient(150deg,#ffffff,#e8e8e4)",
        border: active ? "2px solid #c6f73c" : "2px solid #c9c9c4",
        boxShadow: "0 3px 8px rgba(0,0,0,.5)",
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const on = PIPS[value]?.some(([pr, pc]) => pr === r && pc === c);
        return (
          <span
            key={i}
            className="rounded-full"
            style={{ background: on ? "#141419" : "transparent" }}
          />
        );
      })}
    </div>
  );
}
