import { Card, SectionTitle, Stat } from "../components/ui";
import { accuracy, usePlayer } from "../lib/store";

const BOARD = [
  { r: 1, n: "Sara", pts: 12480, me: false },
  { r: 2, n: "Kian", pts: 11205, me: false },
  { r: 3, n: "Reza_TR", pts: 9840, me: false },
  { r: 4, n: "MoonBoy", pts: 8120, me: false },
];

const BADGES = [
  { i: "🎯", t: "Sharpshooter", got: true },
  { i: "🔥", t: "7-day streak", got: true },
  { i: "⚔️", t: "10 duel wins", got: true },
  { i: "💎", t: "Diamond", got: false },
  { i: "👑", t: "Season champion", got: false },
  { i: "🚀", t: "100 wins", got: false },
];

export function Profile() {
  const { p } = usePlayer();

  return (
    <div className="vscroll h-full pb-28 px-4 pt-4">
      <div className="text-center">
        <div className="mx-auto h-20 w-20 rounded-full bg-brand/20 border-2 border-brand flex items-center justify-center text-[28px] text-brand font-bold">
          P
        </div>
        <div className="text-[19px] font-extrabold mt-3">{p.name}</div>
        <div className="mono text-[12px] text-t3 mt-0.5">
          Elo {p.elo} · rank 247 of 12,408
        </div>
      </div>

      <Card className="p-4 mt-5 flex gap-3">
        <Stat label="Accuracy" value={`${accuracy(p)}%`} tone="brand" />
        <Stat label="Wins" value={p.wins} tone="up" />
        <Stat label="Losses" value={p.losses} tone="down" />
        <Stat label="Streak" value={`🔥 ${p.streak}`} />
      </Card>

      <SectionTitle>Badges</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {BADGES.map((b, i) => (
          <Card
            key={i}
            className={`p-3 text-center ${b.got ? "" : "opacity-35"}`}
          >
            <div className="text-[26px]">{b.i}</div>
            <div className="text-[11px] text-t2 mt-1">{b.t}</div>
          </Card>
        ))}
      </div>

      <SectionTitle>Season 1 leaderboard</SectionTitle>
      <div className="space-y-2">
        {BOARD.map((b) => (
          <Card key={b.r} className="p-3 flex items-center gap-3">
            <span
              className={`mono w-6 text-center font-bold ${
                b.r <= 3 ? "text-brand" : "text-t3"
              }`}
            >
              {b.r}
            </span>
            <div className="h-8 w-8 rounded-full bg-s3 flex items-center justify-center text-[12px] font-bold">
              {b.n[0]}
            </div>
            <span className="flex-1 text-[14px] font-semibold">{b.n}</span>
            <span className="mono text-[13px] text-t2">
              {b.pts.toLocaleString("en-US")}
            </span>
          </Card>
        ))}

        <Card className="p-3 flex items-center gap-3 border-brand/50 bg-brand/8">
          <span className="mono w-6 text-center font-bold text-brand">247</span>
          <div className="h-8 w-8 rounded-full bg-brand/25 flex items-center justify-center text-[12px] font-bold text-brand">
            P
          </div>
          <span className="flex-1 text-[14px] font-semibold">You</span>
          <span className="mono text-[13px] text-brand font-bold">
            {p.points.toLocaleString("en-US")}
          </span>
        </Card>
      </div>

      <SectionTitle>Transactions</SectionTitle>
      <div className="space-y-1.5">
        {p.ledger.slice(0, 10).map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-xl bg-s1 border border-line px-3 h-11"
          >
            <span className="text-[13px] text-t2">{e.kind}</span>
            <span
              className={`mono text-[13px] font-bold ${
                e.delta >= 0 ? "text-up" : "text-down"
              }`}
            >
              {e.delta >= 0 ? "+" : ""}
              {e.delta.toLocaleString("en-US")} ◈
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
