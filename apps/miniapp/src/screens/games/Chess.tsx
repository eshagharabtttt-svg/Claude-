import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BalancePill, Button, Card } from "../../components/ui";
import { ChessPiece } from "../../components/chesspieces";
import { usePlayer } from "../../lib/store";
import { useFullScreen } from "../../lib/chrome";
import { GameHeader } from "./GameHeader";
import {
  applyMove,
  fileOf,
  inCheck,
  kind,
  KING,
  legalMoves,
  LEVELS,
  materialBalance,
  newGame,
  outcome,
  owner,
  QUEEN,
  rankOf,
  repKey,
  startSearch,
  toSan,
  type Color,
  type Level,
  type Move,
  type Outcome,
  type Position,
} from "../../lib/chess";

const STAKES = [50, 100, 250, 500];
const WIN_MULT = 1.9;

const TIMES = [
  { label: "3 | 2", base: 180, inc: 2 },
  { label: "5 | 3", base: 300, inc: 3 },
  { label: "10 | 0", base: 600, inc: 0 },
  { label: "Untimed", base: 0, inc: 0 },
];

const LEVEL_ORDER: Level[] = ["casual", "club", "expert", "master"];

/** Height the two name plates take out of the board area */
const SEAT_ROWS = 128;

type Side = "white" | "black" | "random";

type Ply = { pos: Position; san: string; move: Move; ids: Map<number, number> };

function buzz(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

const clockText = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ */
/* board painting                                                      */
/* ------------------------------------------------------------------ */

/** Deterministic noise, so the grain does not shimmer on every repaint */
function rng(seed: number) {
  let a = seed + 0x6d2b79f5;
  return () => {
    a = Math.imul(a ^ (a >>> 15), a | 1);
    a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  };
}

const LIGHT = "#f0d9b5";
const DARK = "#ab7a4c";
const FRAME = "#cda06a";

/**
 * Wood, drawn rather than photographed.
 *
 * A flat two-tone board looks like a diagram; a few dozen grain strokes
 * per square are enough to read as a real set, and cost nothing to ship.
 */
function paint(cv: HTMLCanvasElement, size: number, frame: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = size * dpr;
  cv.height = size * dpr;
  cv.style.width = `${size}px`;
  cv.style.height = `${size}px`;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const grain = (
    x: number,
    y: number,
    w: number,
    h: number,
    base: string,
    seed: number,
    lines: number
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);

    const r = rng(seed);
    ctx.lineWidth = Math.max(0.6, h / 90);
    for (let i = 0; i < lines; i++) {
      const yy = y + (h * (i + r() * 0.7)) / lines;
      const dark = r() > 0.55;
      ctx.strokeStyle = dark
        ? `rgba(60,32,10,${0.05 + r() * 0.09})`
        : `rgba(255,240,210,${0.04 + r() * 0.08})`;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      const wobble = h * 0.05;
      ctx.bezierCurveTo(
        x + w * 0.33,
        yy + (r() - 0.5) * wobble,
        x + w * 0.66,
        yy + (r() - 0.5) * wobble,
        x + w,
        yy + (r() - 0.5) * wobble
      );
      ctx.stroke();
    }
    ctx.restore();
  };

  // frame
  grain(0, 0, size, size, FRAME, 991, 90);
  ctx.strokeStyle = "rgba(255,238,205,.5)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, size - 1.5, size - 1.5);
  ctx.strokeStyle = "rgba(60,32,10,.55)";
  ctx.strokeRect(frame - 1.5, frame - 1.5, size - frame * 2 + 3, size - frame * 2 + 3);

  const u = (size - frame * 2) / 8;
  for (let r0 = 0; r0 < 8; r0++) {
    for (let c = 0; c < 8; c++) {
      const light = (r0 + c) % 2 === 0;
      grain(
        frame + c * u,
        frame + r0 * u,
        u,
        u,
        light ? LIGHT : DARK,
        r0 * 8 + c + 7,
        light ? 22 : 26
      );
    }
  }

  // a soft vignette so the board sits in the room rather than on top of it
  const g = ctx.createRadialGradient(
    size / 2,
    size * 0.42,
    size * 0.2,
    size / 2,
    size / 2,
    size * 0.78
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,.22)");
  ctx.fillStyle = g;
  ctx.fillRect(frame, frame, size - frame * 2, size - frame * 2);
}

/* ------------------------------------------------------------------ */

export function Chess({ onBack }: { onBack: () => void }) {
  useFullScreen();
  const { p, credit, recordResult } = usePlayer();

  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [level, setLevel] = useState<Level>("club");
  const [side, setSide] = useState<Side>("white");
  const [timeIdx, setTimeIdx] = useState(1);
  const [stake, setStake] = useState(100);

  const [me, setMe] = useState<Color>(0);
  const [pos, setPos] = useState<Position>(newGame);
  const [hist, setHist] = useState<Ply[]>([]);
  const [ids, setIds] = useState<Map<number, number>>(new Map());
  const [cursor, setCursor] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [promo, setPromo] = useState<Move[] | null>(null);
  const [result, setResult] = useState<Outcome | null>(null);
  const [thinking, setThinking] = useState<{ depth: number } | null>(null);
  const [clock, setClock] = useState<[number, number]>([0, 0]);

  /** The position the game opened on — the target of the ◀ at ply zero */
  const startPos = useRef<Position>(newGame());

  const tc = TIMES[timeIdx];
  const timed = tc.base > 0;
  const live = cursor === hist.length;

  /* ---------- geometry ---------- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const obs = useRef<ResizeObserver | null>(null);

  const boxRef = useCallback((el: HTMLDivElement | null) => {
    obs.current?.disconnect();
    obs.current = null;
    if (!el) return;
    // clientWidth counts padding, which would let the board grow wider
    // than the name plates it sits between — measure the content box
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
    obs.current = new ResizeObserver(measure);
    obs.current.observe(el);
  }, []);
  useEffect(() => () => obs.current?.disconnect(), []);

  const frame = Math.round(size * 0.032);
  const u = (size - frame * 2) / 8;

  useEffect(() => {
    if (canvasRef.current && size > 0) paint(canvasRef.current, size, frame);
  }, [size, frame]);

  /** Board pixel of a square, from the seated player's side */
  const xy = useCallback(
    (sq: number) => {
      const f = fileOf(sq);
      const r = rankOf(sq);
      const col = me === 0 ? f : 7 - f;
      const row = me === 0 ? r : 7 - r;
      return { x: frame + col * u, y: frame + row * u };
    },
    [me, frame, u]
  );

  /* ---------- the position on screen ---------- */

  const shown = live ? pos : cursor === 0 ? startPos.current : hist[cursor - 1].pos;
  const shownIds = live
    ? ids
    : cursor === 0
      ? START_IDS
      : hist[cursor - 1].ids;

  const legal = useMemo(() => (live ? legalMoves(pos) : []), [pos, live]);
  const myTurn = live && !result && pos.turn === me && !promo;

  const targets = useMemo(
    () => (sel === null ? [] : legal.filter((m) => m.from === sel)),
    [sel, legal]
  );

  const lastMove = hist[cursor - 1]?.move ?? null;
  const checked = inCheck(shown) ? shown.king[shown.turn] : null;
  const material = useMemo(() => materialBalance(shown), [shown]);

  const squares = useMemo(() => {
    const out: { id: number; sq: number; pc: number }[] = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const pc = shown.b[sq];
      if (pc !== 0) out.push({ id: shownIds.get(sq) ?? 1000 + sq, sq, pc });
    }
    return out;
  }, [shown, shownIds]);

  /* ---------- starting a game ---------- */

  const begin = () => {
    if (p.balance < stake) return;
    credit(-stake, "Chess entry");
    const colour: Color =
      side === "random" ? ((Math.random() < 0.5 ? 0 : 1) as Color) : side === "white" ? 0 : 1;
    const fresh = newGame();
    startPos.current = fresh;
    setMe(colour);
    setPos(fresh);
    setHist([]);
    setIds(new Map(START_IDS));
    setCursor(0);
    setSel(null);
    setPromo(null);
    setResult(null);
    setThinking(null);
    setClock([tc.base * 1000, tc.base * 1000]);
    setPhase("game");
    buzz(30);
  };

  const finish = useCallback(
    (o: Outcome) => {
      if (!o.over) return;
      setResult(o);
      const won = o.winner === me;
      const drew = o.winner === null;
      if (won) credit(Math.round(stake * WIN_MULT), "Chess win");
      else if (drew) credit(stake, "Chess draw");
      if (!drew) recordResult(won, won ? 140 : -30);
      buzz(won ? [40, 60, 40, 60, 90] : drew ? [40, 60, 40] : 170);
    },
    [me, stake, credit, recordResult]
  );

  /* ---------- playing a move ---------- */

  const play = useCallback(
    (m: Move) => {
      const cur = pos;
      const next = applyMove(cur, m);
      const san = toSan(cur, m, legalMoves(cur));

      // pieces keep their identity across the move so React reuses the
      // same node and CSS slides it, instead of popping it to the target
      const map = new Map(ids);
      const moving = map.get(m.from);
      map.delete(m.from);
      if (m.flag === 2) map.delete(m.to + (owner(m.pc) === 0 ? 16 : -16));
      if (moving !== undefined) map.set(m.to, moving);
      if (m.flag === 3) {
        const rf = m.to > m.from ? m.from + 3 : m.from - 4;
        const rt = m.to > m.from ? m.to - 1 : m.to + 1;
        const rook = map.get(rf);
        map.delete(rf);
        if (rook !== undefined) map.set(rt, rook);
      }

      const nh = [...hist, { pos: next, san, move: m, ids: map }];

      setPos(next);
      setIds(map);
      setHist(nh);
      setCursor(nh.length);
      setSel(null);
      if (timed) {
        setClock((c) => {
          const nc: [number, number] = [c[0], c[1]];
          nc[owner(m.pc)] += tc.inc * 1000;
          return nc;
        });
      }
      buzz(m.cap !== 0 ? [12, 26, 12] : 12);

      const keys = [repKey(startPos.current), ...nh.map((x) => repKey(x.pos))];
      const o = outcome(next, keys);
      if (o.over) setTimeout(() => finish(o), 280);
    },
    [pos, ids, hist, finish, timed, tc.inc]
  );

  /* ---------- the engine's turn ---------- */

  useEffect(() => {
    if (phase !== "game" || result || promo) return;
    if (pos.turn === me) return;
    if (legalMoves(pos).length === 0) return;

    let dead = false;
    const search = startSearch(pos, level);

    // one depth per tick, so the board keeps painting while it thinks
    const step = () => {
      if (dead) return;
      const r = search.next();
      if (r) {
        setThinking({ depth: r.depth });
        setTimeout(step, 0);
        return;
      }
      const b = search.best();
      setThinking(null);
      if (b.move) play(b.move);
    };

    // a beat before it answers, so it does not feel like a lookup table
    const kick = setTimeout(step, 420);
    return () => {
      dead = true;
      clearTimeout(kick);
    };
  }, [pos, phase, result, promo, me, level, play]);

  /* ---------- clocks ---------- */

  useEffect(() => {
    if (phase !== "game" || !timed || result || promo) return;
    if (hist.length === 0 && pos.turn !== me) return;
    const started = Date.now();
    const who = pos.turn;
    const from = clock[who];
    const id = setInterval(() => {
      const leftMs = from - (Date.now() - started);
      setClock((c) => {
        const nc: [number, number] = [c[0], c[1]];
        nc[who] = Math.max(0, leftMs);
        return nc;
      });
      if (leftMs <= 0) {
        clearInterval(id);
        finish({
          over: true,
          winner: (1 - who) as Color,
          reason: "checkmate",
        });
      }
    }, 100);
    return () => clearInterval(id);
    // clock is read once when the turn changes and then run off the wall
    // clock, so it cannot drift with React's render timing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.turn, phase, timed, result, promo, hist.length]);

  /* ---------- input ---------- */

  const tap = (sq: number) => {
    if (!myTurn) {
      if (!live) setCursor(hist.length);
      return;
    }
    const mine = shown.b[sq] !== 0 && owner(shown.b[sq]) === me;

    if (sel !== null) {
      const picks = legal.filter((m) => m.from === sel && m.to === sq);
      if (picks.length > 1) {
        setPromo(picks);
        return;
      }
      if (picks.length === 1) {
        play(picks[0]);
        return;
      }
    }
    if (mine) {
      setSel(sq);
      buzz(8);
      return;
    }
    if (sel !== null) setSel(null);
  };

  const resign = () => {
    if (result) return;
    finish({
      over: true,
      winner: (1 - me) as Color,
      reason: "checkmate",
    });
  };

  /* ---------- lobby ---------- */

  if (phase === "lobby") {
    return (
      <div className="vscroll h-full pb-6">
        <GameHeader title="Chess" onBack={onBack}>
          <BalancePill value={p.balance} />
        </GameHeader>

        <div className="px-4 space-y-3.5">
          <Card className="p-5 text-center">
            <div className="flex justify-center items-end gap-1 h-12">
              {[KING, QUEEN, 2, 3].map((t, i) => (
                <div key={t} className="w-9 h-11">
                  <ChessPiece type={t} white={i % 2 === 0} />
                </div>
              ))}
            </div>
            <div className="text-[20px] font-extrabold mt-3">
              Full rules, real engine
            </div>
            <div className="text-[13px] text-t2 mt-1.5 leading-relaxed">
              Castling, en passant, promotion, the fifty-move rule and
              threefold repetition. The opponent searches the position — it
              is not picking from a script.
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-[12px] text-t2 mb-2">Opponent</div>
            <div className="grid grid-cols-4 gap-1.5">
              {LEVEL_ORDER.map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`rounded-xl py-2 text-center ${
                    level === l ? "bg-t1 text-bg" : "bg-s2 text-t2"
                  }`}
                >
                  <div className="text-[12px] font-bold">{LEVELS[l].label}</div>
                  <div
                    className={`mono text-[9px] mt-0.5 ${
                      level === l ? "opacity-70" : "text-t3"
                    }`}
                  >
                    {LEVELS[l].elo}
                  </div>
                </button>
              ))}
            </div>

            <div className="text-[12px] text-t2 mt-4 mb-2">You play</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(["white", "black", "random"] as Side[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`h-9 rounded-xl text-[12px] font-bold capitalize ${
                    side === s ? "bg-t1 text-bg" : "bg-s2 text-t2"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="text-[12px] text-t2 mt-4 mb-2">Time control</div>
            <div className="grid grid-cols-4 gap-1.5">
              {TIMES.map((t, i) => (
                <button
                  key={t.label}
                  onClick={() => setTimeIdx(i)}
                  className={`h-9 rounded-xl text-[12px] font-bold mono ${
                    timeIdx === i ? "bg-t1 text-bg" : "bg-s2 text-t2"
                  }`}
                >
                  {t.label}
                </button>
              ))}
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
                {Math.round(stake * WIN_MULT).toLocaleString("en-US")} ◈
              </span>
            </div>
            <div className="text-center text-[10px] text-t3 pt-2">
              A draw returns your entry
            </div>
          </Card>

          <Button
            size="lg"
            className="w-full"
            disabled={p.balance < stake}
            onClick={begin}
          >
            {p.balance < stake ? "Not enough balance" : `Play · ${stake} ◈`}
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- table ---------- */

  const opp = (1 - me) as Color;

  return (
    <div className="h-full flex flex-col pb-1">
      <GameHeader title="Chess" onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      <div
        ref={boxRef}
        className="flex-1 min-h-0 flex flex-col justify-center gap-2 px-3"
      >
        <Seat
          colour={opp}
          name={LEVELS[level].label}
          sub={LEVELS[level].elo}
          taken={material.taken[opp]}
          edge={opp === 0 ? material.cp : -material.cp}
          ms={clock[opp]}
          timed={timed}
          active={live && !result && pos.turn === opp}
          note={thinking ? `thinking · depth ${thinking.depth}` : undefined}
        />

        <div className="flex items-center justify-center shrink-0">
          <div
            className="relative"
            style={{
              width: size,
              height: size,
              filter: "drop-shadow(0 12px 26px rgba(0,0,0,.6))",
            }}
          >
            <canvas ref={canvasRef} className="block rounded-[10px]" />

            {/* last move */}
            {lastMove &&
              [lastMove.from, lastMove.to].map((sq) => {
                const { x, y } = xy(sq);
                return (
                  <div
                    key={`lm${sq}`}
                    className="absolute pointer-events-none"
                    style={{
                      left: x,
                      top: y,
                      width: u,
                      height: u,
                      background: "rgba(198,247,60,.42)",
                    }}
                  />
                );
              })}

            {/* selection */}
            {sel !== null && (
              <div
                className="absolute pointer-events-none"
                style={{
                  ...boxAt(xy(sel), u),
                  background: "rgba(198,247,60,.55)",
                  boxShadow: "inset 0 0 0 3px rgba(255,255,255,.7)",
                }}
              />
            )}

            {/* the king that is in check */}
            {checked !== null && !result && (
              <div
                className="absolute pointer-events-none"
                style={{
                  ...boxAt(xy(checked), u),
                  background:
                    "radial-gradient(circle, rgba(240,97,109,.95) 12%, rgba(240,97,109,0) 72%)",
                }}
              />
            )}

            {/* pieces */}
            {squares.map((s) => {
              const { x, y } = xy(s.sq);
              return (
                <div
                  key={s.id}
                  className="absolute"
                  style={{
                    left: 0,
                    top: 0,
                    width: u,
                    height: u,
                    transform: `translate(${x}px, ${y}px)`,
                    transition: "transform 170ms cubic-bezier(.3,.9,.4,1)",
                    zIndex: 5,
                    padding: u * 0.04,
                  }}
                >
                  <ChessPiece type={kind(s.pc)} white={owner(s.pc) === 0} />
                </div>
              );
            })}

            {/* legal destinations */}
            {targets.map((m) => {
              const { x, y } = xy(m.to);
              const capture = m.cap !== 0 || m.flag === 2;
              return (
                <div
                  key={`t${m.to}`}
                  className="absolute pointer-events-none flex items-center justify-center"
                  style={{ left: x, top: y, width: u, height: u, zIndex: 8 }}
                >
                  {capture ? (
                    <span
                      className="rounded-full"
                      style={{
                        width: u * 0.9,
                        height: u * 0.9,
                        boxShadow: "inset 0 0 0 4px rgba(20,16,10,.45)",
                      }}
                    />
                  ) : (
                    <span
                      className="rounded-full"
                      style={{
                        width: u * 0.28,
                        height: u * 0.28,
                        background: "rgba(20,16,10,.38)",
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* hit targets on top of everything */}
            {ALL_SQUARES.map((sq) => {
              const { x, y } = xy(sq);
              return (
                <button
                  key={`h${sq}`}
                  onClick={() => tap(sq)}
                  className="absolute"
                  style={{ left: x, top: y, width: u, height: u, zIndex: 12 }}
                />
              );
            })}
          </div>
        </div>

        <Seat
          colour={me}
          name={p.name}
          sub={`${p.elo} elo`}
          taken={material.taken[me]}
          edge={me === 0 ? material.cp : -material.cp}
          ms={clock[me]}
          timed={timed}
          active={myTurn}
        />
      </div>

      {/* status + move navigation */}
      <div className="px-3 pt-2 shrink-0">
        <div className="flex items-center gap-2">
          <NavBtn
            dir="◀"
            disabled={cursor === 0}
            onClick={() => setCursor((c) => Math.max(0, c - 1))}
          />

          <div className="flex-1 min-w-0 rounded-2xl border border-line bg-s1 px-3 py-2.5 text-center">
            <div className="text-[14px] font-extrabold truncate">
              {result
                ? resultLine(result, me)
                : !live
                  ? "Reviewing — tap the board to return"
                  : myTurn
                    ? "Your move"
                    : `${LEVELS[level].label} is thinking`}
            </div>
            <div className="hscroll flex gap-1.5 mt-1.5 justify-center">
              {hist.length === 0 ? (
                <span className="text-[10px] text-t3">no moves yet</span>
              ) : (
                hist.slice(-8).map((h, i) => {
                  const n = hist.length - Math.min(8, hist.length) + i;
                  return (
                    <button
                      key={n}
                      onClick={() => setCursor(n + 1)}
                      className={`shrink-0 mono text-[10px] px-1.5 py-0.5 rounded ${
                        cursor === n + 1 ? "bg-brand text-bg" : "text-t2 bg-s2"
                      }`}
                    >
                      {n % 2 === 0 ? `${n / 2 + 1}.` : ""}
                      {h.san}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <NavBtn
            dir="▶"
            disabled={live}
            onClick={() => setCursor((c) => Math.min(hist.length, c + 1))}
          />
        </div>

        <div className="flex gap-2 mt-2">
          <button
            onClick={resign}
            disabled={!!result}
            className="flex-1 h-10 rounded-xl bg-s2 text-t2 text-[12px] font-bold disabled:opacity-40"
          >
            Resign
          </button>
          <button
            onClick={() => setPhase("lobby")}
            className="flex-1 h-10 rounded-xl bg-s2 text-t2 text-[12px] font-bold"
          >
            New game
          </button>
        </div>
      </div>

      {/* promotion */}
      {promo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
          <Card className="w-full max-w-xs p-4 slideup">
            <div className="text-[14px] font-extrabold text-center mb-3">
              Promote to
            </div>
            <div className="grid grid-cols-4 gap-2">
              {promo.map((m) => (
                <button
                  key={m.promo}
                  onClick={() => {
                    const chosen = m;
                    setPromo(null);
                    play(chosen);
                  }}
                  className="aspect-square rounded-xl bg-s2 active:bg-s3 p-1.5"
                >
                  <ChessPiece type={m.promo} white={me === 0} />
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* result */}
      {result?.over && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 px-4 pb-6">
          <Card className="w-full max-w-md p-5 slideup text-center">
            <div className="text-[42px] leading-none pop">
              {result.winner === me ? "🏆" : result.winner === null ? "🤝" : "😔"}
            </div>
            <div className="text-[20px] font-extrabold mt-2">
              {resultLine(result, me)}
            </div>
            <div className="text-[12px] text-t3 mt-1 capitalize">
              {result.reason}
            </div>
            {result.winner === me && (
              <div className="mono text-brand text-[24px] font-bold mt-1">
                +{Math.round(stake * WIN_MULT).toLocaleString("en-US")} ◈
              </div>
            )}
            {result.winner === null && (
              <div className="mono text-t2 text-[18px] font-bold mt-1">
                Entry returned
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
/* small parts                                                         */
/* ------------------------------------------------------------------ */

const ALL_SQUARES = (() => {
  const out: number[] = [];
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    out.push(sq);
  }
  return out;
})();

const START_IDS = (() => {
  const m = new Map<number, number>();
  let n = 0;
  for (const sq of ALL_SQUARES) {
    const r = rankOf(sq);
    if (r <= 1 || r >= 6) m.set(sq, n++);
  }
  return m;
})();

const boxAt = ({ x, y }: { x: number; y: number }, u: number) => ({
  left: x,
  top: y,
  width: u,
  height: u,
});

function resultLine(o: Outcome, me: Color) {
  if (!o.over) return "";
  if (o.winner === null) return "Draw";
  return o.winner === me ? "You win" : "You lose";
}

function NavBtn({
  dir,
  disabled,
  onClick,
}: {
  dir: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-12 w-11 shrink-0 rounded-xl bg-s2 text-t2 text-[13px] active:bg-s3 disabled:opacity-30"
    >
      {dir}
    </button>
  );
}

function Seat({
  colour,
  name,
  sub,
  taken,
  edge,
  ms,
  timed,
  active,
  note,
}: {
  colour: Color;
  name: string;
  sub: string;
  taken: number[];
  edge: number;
  ms: number;
  timed: boolean;
  active: boolean;
  note?: string;
}) {
  const low = timed && ms < 20000;
  return (
    <div
      className="rounded-2xl border px-2.5 py-2 flex items-center gap-2.5 shrink-0 transition-all"
      style={{
        background: active ? "var(--color-s3)" : "var(--color-s1)",
        borderColor: active ? "#c6f73c" : "var(--color-line)",
        boxShadow: active ? "0 0 16px rgba(198,247,60,.22)" : "none",
      }}
    >
      <div
        className="h-9 w-9 rounded-xl shrink-0 grid place-items-center"
        style={{
          background: colour === 0 ? "#f1eee6" : "#26262e",
          border: "1px solid rgba(255,255,255,.14)",
        }}
      >
        <div className="w-6 h-6">
          <ChessPiece type={KING} white={colour === 0} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-extrabold truncate">{name}</span>
          {edge > 0 && (
            <span className="mono text-[10px] text-up">
              +{Math.round(edge / 100)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5 h-3.5">
          {taken.length === 0 ? (
            <span className="text-[9px] text-t3">{note ?? sub}</span>
          ) : (
            taken.slice(0, 12).map((t, i) => (
              <span key={i} className="w-3 h-3.5 -ml-[3px] first:ml-0 opacity-80">
                <ChessPiece type={t} white={colour !== 0} />
              </span>
            ))
          )}
        </div>
      </div>

      <div
        className={`mono text-[17px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
          low ? "text-down" : active ? "text-t1" : "text-t2"
        }`}
        style={{ background: active ? "rgba(255,255,255,.07)" : "transparent" }}
      >
        {timed ? clockText(ms) : "—:—"}
      </div>
    </div>
  );
}
