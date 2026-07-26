import { useCallback, useEffect, useRef, useState } from "react";
import { BalancePill, Button, Card as Panel } from "../../components/ui";
import { usePlayer } from "../../lib/store";
import { GameHeader } from "./GameHeader";
import {
  botPlay,
  cardId,
  chooseTrump,
  deal,
  HANDS_TO_WIN,
  legalMoves,
  next,
  rankLabel,
  RED,
  scoreHand,
  nextHakem,
  sortHand,
  SUITS,
  team,
  TRICKS_TO_WIN,
  trickWinner,
  type Card,
  type Play,
  type Seat,
  type Suit,
} from "../../lib/hokm";

const STAKES = [50, 100, 250, 500];
const SEAT_NAMES = ["You", "Kian", "Sara", "Nima"];
const BOT_MS = 750;
const TRICK_MS = 900;

type Phase = "lobby" | "trump" | "play" | "hand" | "game";

function buzz(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

export function Hokm({ onBack }: { onBack: () => void }) {
  const { p, credit, recordResult } = usePlayer();
  const [phase, setPhase] = useState<Phase>("lobby");
  const [stake, setStake] = useState(100);
  const [hakem, setHakem] = useState<Seat>(0);
  const [hands, setHands] = useState<Card[][]>([[], [], [], []]);
  const [peek, setPeek] = useState<Card[]>([]);
  const [trump, setTrump] = useState<Suit | null>(null);
  const [trick, setTrick] = useState<Play[]>([]);
  const [turn, setTurn] = useState<Seat>(0);
  const [tricks, setTricks] = useState<[number, number]>([0, 0]);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [lastWinner, setLastWinner] = useState<Seat | null>(null);
  const [note, setNote] = useState("");

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  /* ---------- flow ---------- */

  const startHand = useCallback((h: Seat) => {
    const d = deal(h);
    setHands(d.hands);
    setPeek(d.peek);
    setTrump(null);
    setTrick([]);
    setTricks([0, 0]);
    setLastWinner(null);
    setTurn(h);
    setPhase("trump");
    if (h !== 0) {
      // a bot Hakem names trump after a beat, so the choice reads as a move
      const t = setTimeout(() => {
        const s = chooseTrump(d.peek);
        setTrump(s);
        setNote(`${SEAT_NAMES[h]} calls ${s}`);
        setPhase("play");
      }, 1100);
      timers.current.push(t);
    } else {
      setNote("You are Hakem — call the trump suit");
    }
  }, []);

  const startGame = () => {
    if (p.balance < stake) return;
    credit(-stake, "Hokm entry");
    setScore([0, 0]);
    const first = Math.floor(Math.random() * 4) as Seat;
    setHakem(first);
    startHand(first);
    buzz(30);
  };

  const callTrump = (s: Suit) => {
    setTrump(s);
    setNote(`Trump is ${s}`);
    setPhase("play");
    buzz(25);
  };

  const play = useCallback(
    (seat: Seat, card: Card) => {
      setHands((hs) =>
        hs.map((h, i) =>
          i === seat ? h.filter((c) => cardId(c) !== cardId(card)) : h
        )
      );
      setTrick((t) => [...t, { seat, card }]);
      setTurn((s) => next(s));
    },
    []
  );

  // bots take their turn
  useEffect(() => {
    if (phase !== "play" || !trump) return;
    if (trick.length >= 4) return;
    if (turn === 0) return;
    const t = setTimeout(() => {
      const hand = hands[turn];
      if (!hand.length) return;
      play(turn, botPlay(hand, trick, trump, turn));
    }, BOT_MS);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [phase, turn, trick, trump, hands, play]);

  // resolve a completed trick
  useEffect(() => {
    if (phase !== "play" || trick.length !== 4 || !trump) return;
    const w = trickWinner(trick, trump);
    setLastWinner(w);
    const t = setTimeout(() => {
      setTricks((cur) => {
        const nextTricks: [number, number] = [cur[0], cur[1]];
        nextTricks[team(w)]++;

        if (nextTricks[0] >= TRICKS_TO_WIN || nextTricks[1] >= TRICKS_TO_WIN) {
          const res = scoreHand(nextTricks, hakem);
          setScore((s) => {
            const ns: [number, number] = [s[0], s[1]];
            ns[res.winner] += res.points;
            setNote(
              `${res.winner === 0 ? "Your team" : "Their team"} takes the hand${
                res.kot ? " — kot!" : ""
              }`
            );
            setPhase(
              ns[0] >= HANDS_TO_WIN || ns[1] >= HANDS_TO_WIN ? "game" : "hand"
            );
            return ns;
          });
          buzz(res.winner === 0 ? [30, 50, 30] : 120);
        }
        return nextTricks;
      });
      setTrick([]);
      setTurn(w);
      setLastWinner(null);
    }, TRICK_MS);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [phase, trick, trump, hakem]);

  // settle the match
  const settled = useRef(false);
  useEffect(() => {
    if (phase !== "game" || settled.current) return;
    settled.current = true;
    const won = score[0] > score[1];
    if (won) credit(Math.round(stake * 1.9), "Hokm win");
    recordResult(won, won ? 80 : -20);
    buzz(won ? [40, 60, 40, 60, 90] : 150);
  }, [phase, score, stake, credit, recordResult]);

  const nextHand = () => {
    const winner: 0 | 1 = score[0] > score[1] ? 0 : 1;
    const h = nextHakem(hakem, winner);
    setHakem(h);
    startHand(h);
  };

  const restart = () => {
    settled.current = false;
    setPhase("lobby");
  };

  /* ---------- lobby ---------- */

  if (phase === "lobby") {
    return (
      <div className="vscroll h-full pb-28">
        <GameHeader title="Hokm" onBack={onBack}>
          <BalancePill value={p.balance} />
        </GameHeader>

        <div className="px-4 space-y-4">
          <Panel className="p-5 text-center">
            <div className="text-[40px] leading-none">🃏</div>
            <div className="text-[20px] font-extrabold mt-2">You and Sara</div>
            <div className="text-[13px] text-t2 mt-1.5 leading-relaxed">
              Partners sit across. The Hakem sees five cards and names the
              trump. Seven tricks take the hand, seven hands take the game.
            </div>
          </Panel>

          <Panel className="p-4">
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
                {Math.round(stake * 1.9).toLocaleString("en-US")} ◈
              </span>
            </div>
          </Panel>

          <Button
            size="lg"
            className="w-full"
            disabled={p.balance < stake}
            onClick={startGame}
          >
            {p.balance < stake ? "Not enough balance" : `Deal · ${stake} ◈`}
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- table ---------- */

  const myLegal = trump ? legalMoves(hands[0], trick) : [];
  const legalIds = new Set(myLegal.map(cardId));
  const myTurn = phase === "play" && turn === 0 && trick.length < 4;

  const played = (seat: Seat) => trick.find((t) => t.seat === seat)?.card;

  return (
    <div className="h-full flex flex-col pb-[68px]">
      <GameHeader title="Hokm" onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      {/* scoreboard */}
      <div className="px-4 pb-2 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-t3">Trump</span>
          <span
            className={`h-8 w-8 rounded-lg bg-s2 border border-line flex items-center justify-center text-[17px] ${
              trump && RED.includes(trump) ? "text-down" : "text-t1"
            }`}
          >
            {trump ?? "?"}
          </span>
        </div>

        <div className="text-center">
          <div className="mono text-[20px] font-extrabold leading-none">
            <span className="text-brand">{score[0]}</span>
            <span className="text-t3 mx-1.5">–</span>
            <span className="text-t2">{score[1]}</span>
          </div>
          <div className="text-[9px] text-t3 mt-0.5">hands to {HANDS_TO_WIN}</div>
        </div>

        <div className="text-right">
          <div className="mono text-[15px] font-bold">
            <span className="text-up">{tricks[0]}</span>
            <span className="text-t3 mx-1">:</span>
            <span className="text-down">{tricks[1]}</span>
          </div>
          <div className="text-[9px] text-t3">tricks</div>
        </div>
      </div>

      {/* table */}
      <div className="flex-1 min-h-[260px] max-h-[380px] relative mx-3 rounded-2xl border border-line bg-s1/50 overflow-hidden">
        {/* north — partner */}
        <SeatBadge
          seat={2}
          turn={turn}
          hakem={hakem}
          count={hands[2].length}
          className="absolute top-2 left-1/2 -translate-x-1/2"
        />
        <SeatBadge
          seat={1}
          turn={turn}
          hakem={hakem}
          count={hands[1].length}
          className="absolute left-2 top-1/2 -translate-y-1/2"
        />
        <SeatBadge
          seat={3}
          turn={turn}
          hakem={hakem}
          count={hands[3].length}
          className="absolute right-2 top-1/2 -translate-y-1/2"
        />

        {/* played cards */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-[176px] w-[176px]">
            <Slot card={played(2)} win={lastWinner === 2} className="top-0 left-1/2 -translate-x-1/2" />
            <Slot card={played(1)} win={lastWinner === 1} className="left-0 top-1/2 -translate-y-1/2" />
            <Slot card={played(3)} win={lastWinner === 3} className="right-0 top-1/2 -translate-y-1/2" />
            <Slot card={played(0)} win={lastWinner === 0} className="bottom-0 left-1/2 -translate-x-1/2" />
          </div>
        </div>

        {note && (
          <div className="absolute bottom-2 inset-x-2 text-center">
            <span className="text-[11px] text-t2 bg-bg/70 rounded-full px-3 py-1">
              {note}
            </span>
          </div>
        )}
      </div>

      {/* trump call */}
      {phase === "trump" && hakem === 0 && (
        <div className="px-3 pt-3 pb-1 shrink-0 mt-auto">
          <div className="rounded-2xl border border-brand/40 bg-brand/8 p-3">
            <div className="text-[12px] font-bold text-center mb-2">
              Your five — call the trump
            </div>
            <div className="flex justify-center gap-1.5 mb-3">
              {sortHand(peek).map((c) => (
                <PlayCard key={cardId(c)} card={c} size="sm" />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SUITS.map((s) => (
                <button
                  key={s}
                  onClick={() => callTrump(s)}
                  className={`h-12 rounded-xl bg-s2 border border-line active:bg-s3 text-[22px] ${
                    RED.includes(s) ? "text-down" : "text-t1"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* your hand */}
      {phase !== "trump" && (
        <div className="pt-3 pb-1 shrink-0 mt-auto">
          <div className="flex items-center justify-between px-4 pb-1.5">
            <span className="text-[10px] text-t3">
              Your hand · {hands[0].length}
            </span>
            <span
              className={`text-[10px] font-bold ${
                myTurn ? "text-brand" : "text-t3"
              }`}
            >
              {myTurn ? "your turn" : SEAT_NAMES[turn] + " is thinking…"}
            </span>
          </div>
          <div className="hscroll flex gap-1 px-4 pb-1">
            {hands[0].map((c) => {
              const ok = myTurn && legalIds.has(cardId(c));
              return (
                <button
                  key={cardId(c)}
                  disabled={!ok}
                  onClick={() => play(0, c)}
                  className={`shrink-0 transition-transform ${
                    ok ? "active:-translate-y-1.5" : "opacity-35"
                  }`}
                >
                  <PlayCard card={c} dim={!ok} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* hand / game result */}
      {(phase === "hand" || phase === "game") && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 px-4 pb-6">
          <Panel className="w-full max-w-md p-5 slideup text-center">
            <div className="text-[40px] leading-none pop">
              {phase === "game"
                ? score[0] > score[1]
                  ? "🏆"
                  : "😔"
                : tricks[0] >= TRICKS_TO_WIN
                  ? "✅"
                  : "❌"}
            </div>
            <div className="text-[20px] font-extrabold mt-2">
              {phase === "game"
                ? score[0] > score[1]
                  ? "You win the game"
                  : "They win the game"
                : note}
            </div>
            <div className="mono text-[15px] text-t2 mt-1">
              {score[0]} – {score[1]}
            </div>
            {phase === "game" && score[0] > score[1] && (
              <div className="mono text-brand text-[24px] font-bold mt-1">
                +{Math.round(stake * 1.9).toLocaleString("en-US")} ◈
              </div>
            )}
            <Button
              size="lg"
              className="w-full mt-4"
              onClick={phase === "game" ? restart : nextHand}
            >
              {phase === "game" ? "Play again" : "Next hand"}
            </Button>
          </Panel>
        </div>
      )}
    </div>
  );
}

/* ---------- pieces ---------- */

function SeatBadge({
  seat,
  turn,
  hakem,
  count,
  className,
}: {
  seat: Seat;
  turn: Seat;
  hakem: Seat;
  count: number;
  className?: string;
}) {
  const active = turn === seat;
  const mate = team(seat) === 0;
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div
        className={`h-9 w-9 rounded-full flex items-center justify-center text-[12px] font-bold border transition-colors ${
          active
            ? "bg-brand text-bg border-brand"
            : mate
              ? "bg-brand/15 text-brand border-brand/40"
              : "bg-s2 text-t2 border-line"
        }`}
      >
        {SEAT_NAMES[seat][0]}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-t3">{SEAT_NAMES[seat]}</span>
        {hakem === seat && (
          <span className="text-[8px] font-bold text-warn">HAKEM</span>
        )}
      </div>
      <span className="mono text-[8px] text-t3">{count}</span>
    </div>
  );
}

function Slot({
  card,
  win,
  className,
}: {
  card?: Card;
  win: boolean;
  className?: string;
}) {
  return (
    <div className={`absolute ${className}`}>
      {card ? (
        <div className={win ? "pop" : "slideup"}>
          <PlayCard card={card} highlight={win} />
        </div>
      ) : (
        <div className="h-[54px] w-[38px] rounded-md border border-dashed border-line/60" />
      )}
    </div>
  );
}

function PlayCard({
  card,
  size = "md",
  dim,
  highlight,
}: {
  card: Card;
  size?: "sm" | "md";
  dim?: boolean;
  highlight?: boolean;
}) {
  const red = RED.includes(card.s);
  const box =
    size === "sm" ? "h-[46px] w-[33px] text-[11px]" : "h-[54px] w-[38px] text-[13px]";
  return (
    <div
      className={`${box} rounded-md flex flex-col items-center justify-center font-extrabold border ${
        highlight
          ? "bg-white border-brand ring-2 ring-brand"
          : "bg-[#f4f4f2] border-[#d8d8d4]"
      } ${dim ? "grayscale" : ""}`}
      style={{ color: red ? "#d1242f" : "#16161a" }}
    >
      <span className="leading-none">{rankLabel(card.r)}</span>
      <span className="leading-none mt-0.5">{card.s}</span>
    </div>
  );
}
