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
  ENTRY,
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
  walkPath,
  YARD,
  type Board,
  type Cell,
  type Player,
} from "../../lib/ludo";

const STAKES = [50, 100, 250, 500];
const GRID = 15;
const BOT_MS = 780;
/** One square of travel — slow enough to read, quick enough not to drag */
const STEP_MS = 125;
/** Height the two name-plate rows take out of the board area */
const SEAT_ROWS = 124;

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

/* ------------------------------------------------------------------ */
/* colour helpers                                                      */
/* ------------------------------------------------------------------ */

const hex = (h: string) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/** Blend toward black (t<0) or white (t>0) */
function shade(h: string, t: number) {
  const [r, g, b] = hex(h);
  const to = t < 0 ? 0 : 255;
  const k = Math.abs(t);
  const m = (v: number) => Math.round(v + (to - v) * k);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/* ------------------------------------------------------------------ */

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
  const [pop, setPop] = useState<string | null>(null);

  /** The piece currently walking, drawn at its own cell instead of the board's */
  const [walk, setWalk] = useState<{
    key: string;
    cell: Cell;
    lift: boolean;
  } | null>(null);

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
    // the two name-plate rows sit inside this box, so the board gets what
    // is left. clientWidth counts padding, which would otherwise let the
    // board grow wider than the plates it sits between.
    const measure = () => {
      const cs = getComputedStyle(el);
      const w =
        el.clientWidth -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight);
      const h =
        el.clientHeight -
        parseFloat(cs.paddingTop) -
        parseFloat(cs.paddingBottom);
      setSize(Math.max(0, Math.min(w, h - SEAT_ROWS)));
    };
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

    const round = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    const cell = (r: number, c: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fillRect(c * u, r * u, u, u);
    };

    /* --- yards: colour block, inset panel, four sockets --- */
    const yard = (r0: number, c0: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(c0 * u, r0 * u, 6 * u, 6 * u);

      ctx.fillStyle = "#ffffff";
      round((c0 + 0.42) * u, (r0 + 0.42) * u, 5.16 * u, 5.16 * u, u * 0.3);
      ctx.fill();

      ctx.fillStyle = shade(color, -0.14);
      round((c0 + 0.72) * u, (r0 + 0.72) * u, 4.56 * u, 4.56 * u, u * 0.26);
      ctx.fill();
    };
    yard(0, 0, COLORS[0]);
    yard(0, 9, COLORS[1]);
    yard(9, 9, COLORS[2]);
    yard(9, 0, COLORS[3]);

    for (const pl of PLAYERS) {
      for (const s of YARD[pl]) {
        const cx = (s.c + 0.5) * u;
        const cy = (s.r + 0.5) * u;
        ctx.beginPath();
        ctx.arc(cx, cy, u * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = shade(COLORS[pl], -0.42);
        ctx.fill();
      }
    }

    /* --- the cross: white squares with a hairline grid --- */
    const track: Cell[] = [
      ...RING,
      ...PLAYERS.flatMap((pl) => HOME_PATH[pl]),
    ];
    for (const t of track) cell(t.r, t.c, "#ffffff");

    // home columns and starts wear their owner's colour
    for (const pl of PLAYERS) {
      for (const h of HOME_PATH[pl]) cell(h.r, h.c, COLORS[pl]);
      const s = RING[START[pl]];
      cell(s.r, s.c, COLORS[pl]);
    }

    ctx.strokeStyle = "#c9ccd1";
    ctx.lineWidth = 1;
    for (const t of track) {
      ctx.strokeRect(t.c * u + 0.5, t.r * u + 0.5, u - 1, u - 1);
    }

    /* --- safe squares get an outlined star --- */
    const star = (cx: number, cy: number, r: number, color: string) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.44;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.4, u * 0.07);
      ctx.lineJoin = "round";
      ctx.stroke();
    };
    for (const i of SAFE) {
      if (PLAYERS.some((pl) => START[pl] === i)) continue;
      const s = RING[i];
      star((s.c + 0.5) * u, (s.r + 0.5) * u, u * 0.32, "#8d939c");
    }

    /* --- centre pinwheel: each triangle is its arm's arrowhead --- */
    const mid = 7.5 * u;
    const L = 6 * u;
    const R = 9 * u;
    const tri = (
      a: [number, number],
      b: [number, number],
      color: string
    ) => {
      ctx.beginPath();
      ctx.moveTo(mid, mid);
      ctx.lineTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    tri([L, L], [L, R], COLORS[0]);
    tri([L, L], [R, L], COLORS[1]);
    tri([R, L], [R, R], COLORS[2]);
    tri([L, R], [R, R], COLORS[3]);

    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = Math.max(1.5, u * 0.06);
    ctx.strokeRect(L, L, 3 * u, 3 * u);

    /* --- entry arrows on the square each player turns off --- */
    for (const pl of PLAYERS) {
      const e = RING[ENTRY[pl]];
      const cx = (e.c + 0.5) * u;
      const cy = (e.r + 0.5) * u;
      // point from the entry square toward the middle of the board
      const dx = Math.sign(mid - cx);
      const dy = Math.sign(mid - cy);
      const s = u * 0.3;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s * 0.7, -s);
      ctx.lineTo(-s * 0.7, -s * 0.34);
      ctx.lineTo(-s * 1.25, -s * 0.34);
      ctx.lineTo(-s * 1.25, s * 0.34);
      ctx.lineTo(-s * 0.7, s * 0.34);
      ctx.lineTo(-s * 0.7, s);
      ctx.closePath();
      ctx.strokeStyle = COLORS[pl];
      ctx.lineWidth = Math.max(1.4, u * 0.075);
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.restore();
    }
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
    setWalk(null);
    setNote("Your roll");
    setPhase("roll");
    buzz(30);
  };

  const finishTurn = useCallback(
    (again: boolean, from: Player) => {
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
    },
    [sixes]
  );

  const doMove = useCallback(
    (pl: Player, token: number, roll: number) => {
      setPhase("moving");
      setOptions([]);

      const key = `${pl}-${token}`;
      const from = board[pl][token].steps;
      const to = from < 0 ? 0 : from + roll;
      const path = walkPath(pl, from, to, token);

      const settle = () => {
        const res = applyMove(board, pl, token, roll);
        setWalk(null);
        setBoard(res.board);

        if (res.captured.length) {
          const hit = res.captured[0];
          setNote(`${NAMES[pl]} sends ${NAMES[hit.player]} home`);
          setPop(`${hit.player}-${hit.token}`);
          buzz(pl === 0 ? [30, 60, 30] : 120);
          const clear = setTimeout(() => setPop(null), 500);
          timers.current.push(clear);
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
        }, 380);
        timers.current.push(t);
      };

      let i = 0;
      const hop = () => {
        setWalk({ key, cell: path[i], lift: true });
        buzz(7);
        // the lift comes off part-way through so the piece lands, and the
        // squash on landing is what sells the weight
        const land = setTimeout(
          () => setWalk((w) => (w && w.key === key ? { ...w, lift: false } : w)),
          STEP_MS * 0.58
        );
        timers.current.push(land);

        if (++i < path.length) {
          timers.current.push(setTimeout(hop, STEP_MS));
        } else {
          timers.current.push(setTimeout(settle, STEP_MS + 60));
        }
      };
      hop();
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
          buzz(20);
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
    walking: boolean;
    lift: boolean;
    popped: boolean;
    stack: number;
  };

  const pieces = useMemo<Piece[]>(() => {
    if (!unit) return [];
    const bucket = new Map<string, number>();
    const out: Piece[] = [];

    for (const pl of PLAYERS) {
      board[pl].forEach((t, idx) => {
        const key = `${pl}-${idx}`;
        const walking = walk?.key === key;
        const c = walking ? walk!.cell : cellOf(pl, t.steps, idx);
        const at = `${c.r},${c.c}`;
        const n = bucket.get(at) ?? 0;
        bucket.set(at, n + 1);
        // two pieces on one square fan apart instead of hiding each other
        const off = t.steps < 0 || walking ? 0 : n * unit * 0.17;
        out.push({
          key,
          pl,
          idx,
          x: (c.c + 0.5) * unit + off,
          y: (c.r + 0.5) * unit - off,
          movable: pl === 0 && phase === "pick" && options.includes(idx),
          walking,
          lift: walking && walk!.lift,
          popped: pop === key,
          stack: n,
        });
      });
    }
    return out;
  }, [board, unit, phase, options, walk, pop]);

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
            <div className="flex justify-center gap-2 mb-1">
              {PLAYERS.map((pl) => (
                <TokenArt key={pl} color={COLORS[pl]} width={30} />
              ))}
            </div>
            <div className="text-[20px] font-extrabold mt-2">
              Four pieces, one way home
            </div>
            <div className="text-[13px] text-t2 mt-1.5 leading-relaxed">
              A 2, 4 or 6 lets a piece out. Walk the ring, turn up your own
              column, and land on the last square exactly. Land on somebody and
              they start over — unless they are on a star.
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

      {/* each card sits on the side of the board its yard is on */}
      <div
        ref={boxRef}
        className="flex-1 min-h-0 flex flex-col justify-center gap-2.5 px-3"
      >
        <div className="flex justify-between gap-2 shrink-0">
          <Seat pl={0} live={turn === 0} home={homeCount(0)} />
          <Seat pl={1} live={turn === 1} home={homeCount(1)} right />
        </div>

        <div className="relative flex items-center justify-center shrink-0">
          <div
          className="relative rounded-2xl"
          style={{
            width: size,
            height: size,
            background: "#ffffff",
            boxShadow:
              "0 10px 30px rgba(0,0,0,.55), 0 0 0 5px #ffffff, 0 0 0 6px rgba(0,0,0,.35)",
          }}
        >
          <canvas ref={canvasRef} className="block rounded-2xl" />

          {pieces.map((pc) => (
            <button
              key={pc.key}
              disabled={!pc.movable}
              onClick={() => doMove(0, pc.idx, die)}
              className="absolute"
              style={{
                left: pc.x,
                top: pc.y,
                width: unit * 0.92,
                height: unit * 1.24,
                transform: "translate(-50%,-64%)",
                transition: pc.walking
                  ? `left ${STEP_MS}ms linear, top ${STEP_MS}ms linear`
                  : "left 380ms cubic-bezier(.34,1.3,.64,1), top 380ms cubic-bezier(.34,1.3,.64,1)",
                zIndex: pc.walking ? 40 : pc.movable ? 30 : 10 + pc.stack,
              }}
            >
              <div
                className="w-full h-full origin-bottom"
                style={{
                  transform: pc.lift
                    ? "translateY(-22%) scale(1.06)"
                    : pc.popped
                      ? "scale(1.24)"
                      : pc.movable
                        ? "translateY(-8%)"
                        : "none",
                  transition: "transform 110ms ease-out",
                  filter: pc.movable
                    ? `drop-shadow(0 0 6px ${COLORS[pc.pl]}) drop-shadow(0 0 12px ${COLORS[pc.pl]}88)`
                    : "none",
                  animation: pc.movable ? "ludobob 1s ease-in-out infinite" : "none",
                }}
              >
                <TokenArt color={COLORS[pc.pl]} />
              </div>
            </button>
          ))}
          </div>
        </div>

        <div className="flex justify-between gap-2 shrink-0">
          <Seat pl={3} live={turn === 3} home={homeCount(3)} />
          <Seat pl={2} live={turn === 2} home={homeCount(2)} right />
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
                  ? "Tap a glowing piece"
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

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

/** Name plate for one seat, with a pip per piece already home */
function Seat({
  pl,
  live,
  home,
  right,
}: {
  pl: Player;
  live: boolean;
  home: number;
  right?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border px-2.5 py-2 flex items-center gap-2 transition-all"
      style={{
        background: live ? `${COLORS[pl]}1f` : "var(--color-s1)",
        borderColor: live ? COLORS[pl] : "var(--color-line)",
        boxShadow: live ? `0 0 14px ${COLORS[pl]}55` : "none",
        flexDirection: right ? "row-reverse" : "row",
      }}
    >
      <TokenArt color={COLORS[pl]} width={20} />
      <div style={{ textAlign: right ? "right" : "left" }}>
        <div className="text-[12px] font-extrabold leading-none">
          {NAMES[pl]}
        </div>
        <div
          className="flex gap-[3px] mt-1.5"
          style={{ justifyContent: right ? "flex-end" : "flex-start" }}
        >
          {Array.from({ length: TOKENS }).map((_, i) => (
            <span
              key={i}
              className="h-[5px] w-[5px] rounded-full"
              style={{
                background: i < home ? COLORS[pl] : "rgba(255,255,255,.16)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A Ludo pawn seen slightly from above: a white cylinder for the base
 * and a coloured cap with a white eye. Drawn rather than shaded with a
 * flat circle so the board keeps its depth at any size.
 */
function TokenArt({ color, width }: { color: string; width?: number }) {
  const dark = shade(color, -0.32);
  const light = shade(color, 0.28);
  return (
    <svg
      viewBox="0 0 40 54"
      width={width ?? "100%"}
      height={width ? (width * 54) / 40 : "100%"}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* the contact shadow is what plants it on the square */}
      <ellipse cx="20" cy="48.4" rx="13.4" ry="4" fill="rgba(0,0,0,.32)" />

      {/* base cylinder */}
      <path
        d="M6.8 42.8V36h26.4v6.8a13.2 5.6 0 0 1-26.4 0z"
        fill="#d9dade"
      />
      <ellipse cx="20" cy="42.8" rx="13.2" ry="5.6" fill="#e8e9ec" />
      <ellipse cx="20" cy="36" rx="13.2" ry="5.6" fill="#ffffff" />
      <ellipse cx="20" cy="35.4" rx="9.6" ry="3.9" fill="#e4e5e9" />

      {/* neck */}
      <path d="M11.6 35.6c0-5 3.8-7.6 8.4-7.6s8.4 2.6 8.4 7.6z" fill="#f4f5f7" />

      {/* cap */}
      <circle cx="20" cy="21.6" r="12.6" fill={dark} />
      <circle cx="20" cy="20" r="12.6" fill={color} />
      <circle cx="20" cy="20" r="12.6" fill="url(#tokShade)" />
      <circle cx="20" cy="20" r="5.4" fill="#ffffff" />
      <ellipse
        cx="15"
        cy="12.6"
        rx="5"
        ry="3"
        fill={light}
        opacity=".55"
        transform="rotate(-30 15 12.6)"
      />

      <defs>
        <radialGradient id="tokShade" cx="34%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".34" />
          <stop offset="58%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity=".22" />
        </radialGradient>
      </defs>
    </svg>
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
      className="h-14 w-14 rounded-xl grid grid-cols-3 grid-rows-3 gap-0.5 p-2 shrink-0"
      style={{
        background: "linear-gradient(150deg,#ffffff,#dfdfda)",
        border: active ? "2px solid #c6f73c" : "2px solid #c9c9c4",
        boxShadow:
          "0 4px 10px rgba(0,0,0,.5), inset 0 -3px 6px rgba(0,0,0,.12), inset 0 2px 4px rgba(255,255,255,.9)",
        transform: rolling ? "rotate(-8deg) scale(.94)" : "none",
        transition: "transform 90ms ease-out",
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
            style={{
              background: on ? "#16161c" : "transparent",
              boxShadow: on ? "inset 0 1px 1px rgba(255,255,255,.25)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}
