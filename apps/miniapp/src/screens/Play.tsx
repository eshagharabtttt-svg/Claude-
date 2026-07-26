import { useState } from "react";
import { BalancePill, Card } from "../components/ui";
import { usePlayer } from "../lib/store";
import { QuickPlay } from "./QuickPlay";
import { StreakRun } from "./games/StreakRun";
import { Royale } from "./games/Royale";
import { Crash } from "./games/Crash";
import { Parlay } from "./games/Parlay";

type Game = "quick" | "streak" | "royale" | "crash" | "parlay";

const GAMES: {
  id: Game;
  icon: string;
  name: string;
  blurb: string;
  tag: string;
  tint: string;
}[] = [
  {
    id: "quick",
    icon: "⚡",
    name: "Quick Play",
    blurb: "Up or down in 30 seconds",
    tag: "30s rounds",
    tint: "#c6f73c",
  },
  {
    id: "streak",
    icon: "🔥",
    name: "Streak Run",
    blurb: "Climb the ladder, cash out before you miss",
    tag: "up to ×170",
    tint: "#f5a524",
  },
  {
    id: "royale",
    icon: "🏹",
    name: "Battle Royale",
    blurb: "50 players, one survivor takes the pot",
    tag: "50 players",
    tint: "#f0616d",
  },
  {
    id: "crash",
    icon: "🚀",
    name: "Crash",
    blurb: "Cash out before the rocket blows",
    tag: "provably fair",
    tint: "#a855f7",
  },
  {
    id: "parlay",
    icon: "🎫",
    name: "Parlay",
    blurb: "Stack real event calls into one ticket",
    tag: "combo odds",
    tint: "#3b82f6",
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

  return (
    <div className="vscroll h-full pb-28">
      <header className="flex items-center justify-between px-4 pt-4 pb-1">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight">Play</h1>
          <p className="text-t3 text-xs mt-0.5">Pick a game</p>
        </div>
        <BalancePill value={p.balance} />
      </header>

      <div className="px-4 pt-4 space-y-3">
        {GAMES.map((g) => (
          <Card
            key={g.id}
            onClick={() => setGame(g.id)}
            className="p-4 flex items-center gap-4 active:bg-s2 transition-colors"
          >
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-[26px] shrink-0"
              style={{
                background: `${g.tint}1f`,
                border: `1px solid ${g.tint}44`,
              }}
            >
              {g.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-extrabold">{g.name}</span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: `${g.tint}22`, color: g.tint }}
                >
                  {g.tag}
                </span>
              </div>
              <div className="text-[12px] text-t2 mt-1 leading-snug">
                {g.blurb}
              </div>
            </div>

            <span className="text-t3 text-[18px] shrink-0">›</span>
          </Card>
        ))}
      </div>

      <p className="px-4 pt-5 text-center text-[11px] text-t3 leading-relaxed">
        Every game settles into the same balance and the same season score.
      </p>
    </div>
  );
}
