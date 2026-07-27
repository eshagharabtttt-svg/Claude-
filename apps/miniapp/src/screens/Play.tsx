import { useState } from "react";
import { BalancePill } from "../components/ui";
import { usePlayer } from "../lib/store";
import { QuickPlay } from "./QuickPlay";
import { StreakRun } from "./games/StreakRun";
import { Royale } from "./games/Royale";
import { Crash } from "./games/Crash";
import { Parlay } from "./games/Parlay";
import { Hokm } from "./games/Hokm";
import { Dice } from "./games/Dice";
import { Limbo } from "./games/Limbo";
import { Wheel } from "./games/Wheel";
import { Mines } from "./games/Mines";
import { Plinko } from "./games/Plinko";
import { Ludo } from "./games/Ludo";
import { Chess } from "./games/Chess";

type Game = "quick" | "streak" | "royale" | "crash" | "parlay" | "hokm" | "dice" | "limbo" | "wheel" | "mines" | "plinko" | "ludo" | "chess";

type Tile = {
  id: Game;
  name: string;
  art: string;
  /** headline badge painted on the art, the way arcade tiles shout a number */
  badge: string;
  players: number;
  from: string;
  to: string;
  ink: string;
};

const TILES: Tile[] = [
  {
    id: "crash",
    name: "Crash",
    art: "🚀",
    badge: "999×",
    players: 1363,
    from: "#7c3aed",
    to: "#c026d3",
    ink: "#fde68a",
  },
  {
    id: "streak",
    name: "Streak Run",
    art: "🔥",
    badge: "×170",
    players: 206,
    from: "#ea580c",
    to: "#f59e0b",
    ink: "#fff7ed",
  },
  {
    id: "royale",
    name: "Battle Royale",
    art: "🏹",
    badge: "50 in",
    players: 122,
    from: "#be123c",
    to: "#f0616d",
    ink: "#ffe4e6",
  },
  {
    id: "quick",
    name: "Quick Play",
    art: "📈",
    badge: "30s",
    players: 160,
    from: "#4d7c0f",
    to: "#a3e635",
    ink: "#0a0a0b",
  },
  {
    id: "hokm",
    name: "Hokm",
    art: "🃏",
    badge: "2v2",
    players: 341,
    from: "#065f46",
    to: "#10b981",
    ink: "#ecfdf5",
  },
  {
    id: "dice",
    name: "Dice",
    art: "🎲",
    badge: "49.5×",
    players: 512,
    from: "#0f766e",
    to: "#2dd4bf",
    ink: "#ccfbf1",
  },
  {
    id: "limbo",
    name: "Limbo",
    art: "🛸",
    badge: "1000×",
    players: 274,
    from: "#155e75",
    to: "#22d3ee",
    ink: "#cffafe",
  },
  {
    id: "wheel",
    name: "Wheel",
    art: "🎡",
    badge: "47.5×",
    players: 198,
    from: "#a16207",
    to: "#fbbf24",
    ink: "#451a03",
  },
  {
    id: "mines",
    name: "Mines",
    art: "💣",
    badge: "24 in 25",
    players: 156,
    from: "#9333ea",
    to: "#e879f9",
    ink: "#fae8ff",
  },
  {
    id: "plinko",
    name: "Plinko",
    art: "🔴",
    badge: "420×",
    players: 231,
    from: "#0369a1",
    to: "#7dd3fc",
    ink: "#082f49",
  },
  {
    id: "ludo",
    name: "Ludo",
    art: "🎯",
    badge: "4 players",
    players: 407,
    from: "#b91c1c",
    to: "#fb923c",
    ink: "#fff7ed",
  },
  {
    id: "chess",
    name: "Chess",
    art: "♞",
    badge: "vs engine",
    players: 612,
    from: "#3f3f46",
    to: "#a1a1aa",
    ink: "#18181b",
  },
  {
    id: "parlay",
    name: "Parlay",
    art: "🎫",
    badge: "combo",
    players: 84,
    from: "#1d4ed8",
    to: "#38bdf8",
    ink: "#e0f2fe",
  },
];

export function Play() {
  const { p } = usePlayer();
  const [game, setGame] = useState<Game | null>(null);
  const back = () => setGame(null);

  if (game === "quick") return <QuickPlay onBack={back} />;
  if (game === "streak") return <StreakRun onBack={back} />;
  if (game === "royale") return <Royale onBack={back} />;
  if (game === "crash") return <Crash onBack={back} />;
  if (game === "parlay") return <Parlay onBack={back} />;
  if (game === "hokm") return <Hokm onBack={back} />;
  if (game === "dice") return <Dice onBack={back} />;
  if (game === "limbo") return <Limbo onBack={back} />;
  if (game === "wheel") return <Wheel onBack={back} />;
  if (game === "mines") return <Mines onBack={back} />;
  if (game === "plinko") return <Plinko onBack={back} />;
  if (game === "ludo") return <Ludo onBack={back} />;
  if (game === "chess") return <Chess onBack={back} />;

  return (
    <div className="vscroll h-full pb-28">
      <header className="flex items-center justify-between px-4 pt-4 pb-4">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight">Play</h1>
          <p className="text-t3 text-xs mt-0.5">
            {TILES.reduce((a, t) => a + t.players, 0).toLocaleString("en-US")}{" "}
            playing now
          </p>
        </div>
        <BalancePill value={p.balance} />
      </header>

      <div className="px-3 grid grid-cols-2 gap-3">
        {TILES.map((t) => (
          <GameTile key={t.id} tile={t} onOpen={() => setGame(t.id)} />
        ))}
      </div>

      <p className="px-6 pt-6 text-center text-[11px] text-t3 leading-relaxed">
        Every game settles into the same balance and the same season score.
      </p>
    </div>
  );
}

function GameTile({ tile, onOpen }: { tile: Tile; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="relative rounded-2xl overflow-hidden aspect-[3/3.4] text-left active:scale-[.97] transition-transform"
      style={{
        background: `linear-gradient(150deg, ${tile.from}, ${tile.to})`,
      }}
    >
      {/* soft light from the top-left, so flat gradients read as objects */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 15% 0%, rgba(255,255,255,.28), transparent 60%)",
        }}
      />

      {/* motif */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[62px] leading-none"
          style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,.35))" }}
        >
          {tile.art}
        </span>
      </div>

      {/* headline badge */}
      <div
        className="absolute top-2.5 left-2.5 mono text-[15px] font-extrabold -rotate-6"
        style={{
          color: tile.ink,
          textShadow: "0 2px 6px rgba(0,0,0,.4)",
        }}
      >
        {tile.badge}
      </div>

      {/* name plate */}
      <div className="absolute inset-x-0 bottom-0 pt-8 pb-2.5 px-2.5 bg-gradient-to-t from-black/75 via-black/45 to-transparent">
        <div className="text-white font-extrabold text-[14px] uppercase tracking-wide leading-tight">
          {tile.name}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-white/55 text-[8px] font-bold tracking-widest">
            ORIGINAL
          </span>
          <span className="flex items-center gap-1 rounded bg-black/45 px-1.5 py-0.5">
            <span className="text-white/60 text-[8px]">👤</span>
            <span className="mono text-white text-[9px] font-bold">
              {tile.players}
            </span>
          </span>
        </div>
      </div>
    </button>
  );
}
