import { useCallback, useEffect, useRef, useState } from "react";
import { BalancePill, Button, Card as Panel } from "../../components/ui";
import { usePlayer } from "../../lib/store";
import { useFullScreen } from "../../lib/chrome";
import { GameHeader } from "./GameHeader";
import { CardFace, CardFan, suitColor } from "../../components/cards";
import {
  botPlay,
  cardId,
  chooseTrump,
  deal,
  HANDS_TO_WIN,
  legalMoves,
  next,
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
  useFullScreen();
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
      <div className="vscroll h-full pb-6">
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
    <div className="h-full flex flex-col pb-1 bg-[#0d0f0d]">
      <GameHeader title="Hokm" onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      {/* felt */}
      <div className="flex-1 min-h-[300px] max-h-[440px] relative mx-2 rounded-[64px] overflow-hidden border-[6px] border-[#1b1c1f] shadow-[inset_0_0_60px_rgba(0,0,0,.55)]"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, #1f6a45 0%, #14päd 60%, #0e3b27 100%)".replace("päd", "4a32"),
        }}
      >
        {/* trump badge */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 rounded-lg bg-bg/85 border border-brand/40 px-2 py-1">
          <span
            className="text-[18px] leading-none"
            style={{ color: trump ? suitColor(trump) : "#5e5e68" }}
          >
            {trump ?? "?"}
          </span>
          <span className="text-[9px] font-extrabold text-brand tracking-wider">HOKM</span>
        </div>

        {/* score */}
        <div className="absolute top-2 right-2 z-20 rounded-lg bg-bg/85 border border-line px-2 py-1 text-center">
          <div className="mono text-[13px] font-extrabold leading-none whitespace-nowrap">
            <span className="text-brand">{score[0]}</span>
            <span className="text-t3 mx-1">–</span>
            <span className="text-t2">{score[1]}</span>
          </div>
          <div className="text-[8px] text-t3 mt-0.5">to {HANDS_TO_WIN}</div>
        </div>

        {/* opponents */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="scale-[.62] origin-top">
            <CardFan count={hands[2].length} />
          </div>
          <Plaque seat={2} turn={turn} hakem={hakem} tricks={tricks[0]} />
        </div>

        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center">
          <div className="scale-[.62] origin-left -ml-6">
            <CardFan count={hands[1].length} vertical />
          </div>
          <Plaque seat={1} turn={turn} hakem={hakem} tricks={tricks[1]} compact />
        </div>

        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center flex-row-reverse">
          <div className="scale-[.62] origin-right -mr-6">
            <CardFan count={hands[3].length} vertical />
          </div>
          <Plaque seat={3} turn={turn} hakem={hakem} tricks={tricks[1]} compact />
        </div>

        {/* played cards */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-[164px] w-[164px]">
            <Slot card={played(2)} win={lastWinner === 2} tilt={4} className="top-0 left-1/2 -translate-x-1/2" />
            <Slot card={played(1)} win={lastWinner === 1} tilt={-8} className="left-1 top-1/2 -translate-y-1/2" />
            <Slot card={played(3)} win={lastWinner === 3} tilt={8} className="right-1 top-1/2 -translate-y-1/2" />
            <Slot card={played(0)} win={lastWinner === 0} tilt={-3} className="bottom-0 left-1/2 -translate-x-1/2" />
          </div>
        </div>

        {/* turn / message */}
        {note && phase === "play" && (
          <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
            <span
              className={`text-[11px] font-bold rounded-full px-3 py-1 ${
                myTurn
                  ? "bg-brand text-bg"
                  : "bg-bg/70 text-t2"
              }`}
            >
              {myTurn ? "Your turn" : note}
            </span>
          </div>
        )}
      </div>

      {/* trump call */}
      {phase === "trump" && hakem === 0 && (
        <div className="px-3 pt-3 pb-1 shrink-0 mt-auto">
          <div className="rounded-2xl border border-brand/40 bg-brand/8 p-3">
            <div className="text-[12px] font-bold text-center mb-2.5">
              You are Hakem — name the trump
            </div>
            <div className="flex justify-center gap-1 mb-3">
              {sortHand(peek).map((c) => (
                <CardFace key={cardId(c)} card={c} w={38} />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SUITS.map((s) => (
                <button
                  key={s}
                  onClick={() => callTrump(s)}
                  className="h-14 rounded-xl bg-[#f4f4f2] border border-[#c9c9c4] active:brightness-90 text-[26px] font-bold"
                  style={{ color: suitColor(s) }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* your hand, fanned */}
      {phase !== "trump" && (
        <div className="shrink-0 mt-auto pt-1">
          <div className="flex items-center justify-between px-4 pb-1">
            <span className="mono text-[10px] text-t3">
              {tricks[0]} : {tricks[1]} tricks
            </span>
            <span className="text-[10px] text-t3">
              {hands[0].length} cards
            </span>
          </div>
          <HandFan
            cards={hands[0]}
            legal={legalIds}
            enabled={myTurn}
            onPlay={(c) => play(0, c)}
          />
        </div>
      )}

      {/* hand / game result */}
      {(phase === "hand" || phase === "game") && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 px-4 pb-6">
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
            <div className="text-[19px] font-extrabold mt-2">
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

function Plaque({
  seat,
  turn,
  hakem,
  tricks,
  compact,
}: {
  seat: Seat;
  turn: Seat;
  hakem: Seat;
  tricks: number;
  compact?: boolean;
}) {
  const active = turn === seat;
  const mate = team(seat) === 0;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-1.5 py-1 backdrop-blur transition-colors ${
        active
          ? "bg-brand/25 border-brand"
          : "bg-bg/70 border-line"
      } ${compact ? "flex-col gap-0.5 px-1" : ""}`}
    >
      <div
        className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
          mate ? "bg-brand/25 text-brand" : "bg-s3 text-t2"
        }`}
      >
        {SEAT_NAMES[seat][0]}
      </div>
      <div className={compact ? "text-center" : ""}>
        <div className="text-[9px] font-bold leading-none">
          {SEAT_NAMES[seat]}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {hakem === seat && (
            <span className="text-[7px] font-extrabold text-warn">HAKEM</span>
          )}
          <span className="mono text-[8px] text-t3">{tricks}</span>
        </div>
      </div>
    </div>
  );
}

function Slot({
  card,
  win,
  tilt,
  className,
}: {
  card?: Card;
  win: boolean;
  tilt: number;
  className?: string;
}) {
  return (
    <div className={`absolute ${className}`}>
      {card ? (
        <div
          className={win ? "pop" : "slideup"}
          style={{ transform: `rotate(${tilt}deg)` }}
        >
          <CardFace card={card} w={44} glow={win} />
        </div>
      ) : (
        <div className="h-[62px] w-[44px] rounded-[6px] border border-dashed border-white/10" />
      )}
    </div>
  );
}

/**
 * The player's hand as an arc. Thirteen cards will not fit side by side on
 * a phone, so they overlap and lift the way a real fan does — and the
 * playable ones lift further so the legal move is obvious at a glance.
 */
function HandFan({
  cards,
  legal,
  enabled,
  onPlay,
}: {
  cards: Card[];
  legal: Set<string>;
  enabled: boolean;
  onPlay: (c: Card) => void;
}) {
  const n = cards.length;
  if (n === 0) return <div className="h-[92px]" />;
  const mid = (n - 1) / 2;
  const step = n > 9 ? 26 : n > 6 ? 32 : 38;
  const spread = 2.4;
  const width = (n - 1) * step + 46;

  return (
    <div className="w-full overflow-x-auto hscroll">
      <div
        className="relative mx-auto h-[96px]"
        style={{ width: Math.max(width, 320) }}
      >
        {cards.map((c, i) => {
          const ok = enabled && legal.has(cardId(c));
          const off = i - mid;
          return (
            <button
              key={cardId(c)}
              disabled={!ok}
              onClick={() => onPlay(c)}
              className="absolute transition-transform"
              style={{
                left: `calc(50% + ${off * step}px - 23px)`,
                bottom: ok ? 14 : 4,
                transform: `rotate(${off * spread}deg)`,
                transformOrigin: "bottom center",
                zIndex: i,
              }}
            >
              <CardFace card={c} w={46} dim={!ok} selected={ok} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
