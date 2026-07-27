import { Button, Card } from "../components/ui";
import { accuracy, usePlayer } from "../lib/store";
import type { Tab } from "../App";

export function Home({ go }: { go: (t: Tab) => void }) {
  const { p } = usePlayer();

  return (
    <div className="vscroll h-full pb-28">
      <header className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-brand/20 border-2 border-brand/50 flex items-center justify-center text-brand font-bold">
            P
          </div>
          <div>
            <div className="text-[15px] font-bold">{p.name}</div>
            <div className="mono text-[11px] text-t3">Elo {p.elo} · Rank 247</div>
          </div>
        </div>
        <button className="h-9 w-9 rounded-full bg-s2 border border-line text-t2">
          ⚙
        </button>
      </header>

      {/* balance */}
      <div className="px-4 mt-6 text-center">
        <div className="text-[12px] text-t2">Token balance</div>
        <div className="mono text-[48px] font-extrabold leading-none mt-1 text-brand">
          {Math.round(p.balance).toLocaleString("en-US")}
        </div>
        <div className="text-[11px] text-t3 mt-2">
          Season 1 score ·{" "}
          <span className="mono">{p.points.toLocaleString("en-US")}</span>
        </div>
      </div>

      {/* energy */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-t2">⚡ Energy</span>
          <span className="mono text-t3">
            {p.energy}/{p.energyMax}
          </span>
        </div>
        <div className="h-2 rounded-full bg-s2 overflow-hidden">
          <div
            className="h-full bg-brand transition-all duration-500"
            style={{ width: `${(p.energy / p.energyMax) * 100}%` }}
          />
        </div>
      </div>

      <div className="px-4 mt-6 grid grid-cols-2 gap-3">
        <Button size="lg" onClick={() => go("play")}>
          ⚡ Play
        </Button>
        <Button size="lg" variant="surface" onClick={() => go("duel")}>
          ⚔️ Duel
        </Button>
      </div>

      {/* stats */}
      <div className="px-4 mt-4">
        <Card className="p-4 flex">
          <div className="flex-1 text-center">
            <div className="mono text-[20px] font-bold text-brand">
              {accuracy(p)}%
            </div>
            <div className="text-[11px] text-t3 mt-0.5">Accuracy</div>
          </div>
          <div className="w-px bg-line" />
          <div className="flex-1 text-center">
            <div className="mono text-[20px] font-bold">
              {p.wins}
              <span className="text-t3 text-[14px]">/{p.wins + p.losses}</span>
            </div>
            <div className="text-[11px] text-t3 mt-0.5">Wins</div>
          </div>
          <div className="w-px bg-line" />
          <div className="flex-1 text-center">
            <div className="mono text-[20px] font-bold text-warn">
              🔥 {p.streak}
            </div>
            <div className="text-[11px] text-t3 mt-0.5">Streak</div>
          </div>
        </Card>
      </div>

      {/* nudge toward the tasks tab */}
      <div className="px-4 mt-4">
        <Card className="p-4 flex items-center gap-3" onClick={() => go("tasks")}>
          <div className="h-10 w-10 rounded-xl bg-brand/15 flex items-center justify-center text-[18px]">
            🎁
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-bold">Daily reward is ready</div>
            <div className="text-[12px] text-t2 mt-0.5">
              Claim it and check today's tasks
            </div>
          </div>
          <span className="text-t3 text-[16px]">›</span>
        </Card>
      </div>
    </div>
  );
}
