import { useState } from "react";
import {
  BalancePill,
  Button,
  Card,
  ProgressRing,
  SectionTitle,
} from "../components/ui";
import { usePlayer } from "../lib/store";

const TASKS = [
  { id: 1, icon: "📣", title: "Join the channel", reward: 200, done: true },
  {
    id: 2,
    icon: "🎯",
    title: "Make 3 correct predictions",
    reward: 350,
    done: false,
    prog: "1/3",
  },
  { id: 3, icon: "⚔️", title: "Win a duel", reward: 500, done: false },
  {
    id: 4,
    icon: "👥",
    title: "Invite an active friend",
    reward: 800,
    done: false,
  },
];

export function Tasks() {
  const { p, credit } = usePlayer();
  const [claimed, setClaimed] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = "t.me/yourbot?start=ref_8241";

  const copy = () => {
    void navigator.clipboard?.writeText(`https://${link}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="vscroll h-full pb-28">
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-[26px] font-extrabold">Tasks</h1>
        <BalancePill value={p.balance} />
      </header>

      {/* daily reward */}
      <div className="px-4">
        <SectionTitle>Daily reward</SectionTitle>
        <Card className="p-4">
          <div className="flex gap-1.5 mb-4">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div
                key={d}
                className={`flex-1 rounded-lg py-2 text-center ${
                  d <= p.streak
                    ? "bg-brand/15 border border-brand/40"
                    : "bg-s2 border border-line"
                }`}
              >
                <div
                  className={`mono text-[10px] ${
                    d <= p.streak ? "text-brand" : "text-t3"
                  }`}
                >
                  {d}
                </div>
                <div className="text-[13px] mt-0.5">
                  {d <= p.streak ? "✓" : "◈"}
                </div>
              </div>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={claimed}
            onClick={() => {
              credit(150, "Daily reward");
              setClaimed(true);
            }}
          >
            {claimed ? "Claimed ✓" : "Claim 150 ◈"}
          </Button>
        </Card>
      </div>

      {/* referral */}
      <div className="px-4">
        <SectionTitle>Invite friends</SectionTitle>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <ProgressRing value={1} max={2} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="mono text-[15px] font-bold">
                  1<span className="text-t3">/2</span>
                </span>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold">Invite 2 active friends</div>
              <div className="text-[12px] text-t2 mt-1">
                to unlock a 2,000 ◈ reward
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-s2 border border-line px-3 h-11">
            <span className="mono text-[11px] text-t3 flex-1 truncate">
              {link}
            </span>
            <button
              onClick={copy}
              className="text-brand text-[13px] font-bold shrink-0"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </Card>
      </div>

      {/* task list */}
      <div className="px-4">
        <SectionTitle>Today's tasks</SectionTitle>
        <div className="space-y-2">
          {TASKS.map((t) => (
            <Card key={t.id} className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-s2 flex items-center justify-center text-[18px]">
                {t.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold">{t.title}</div>
                <div className="mono text-[11px] text-brand mt-0.5">
                  +{t.reward} ◈{" "}
                  {t.prog && <span className="text-t3">· {t.prog}</span>}
                </div>
              </div>
              {t.done ? (
                <span className="text-up text-[13px] font-bold shrink-0">
                  ✓ Done
                </span>
              ) : (
                <Button size="sm">Start</Button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
