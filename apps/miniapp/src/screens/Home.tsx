import { useState } from "react";
import { Button, Card, ProgressRing, SectionTitle } from "../components/ui";
import { accuracy, usePlayer } from "../lib/store";
import type { Tab } from "../App";

const TASKS = [
  { id: 1, icon: "📣", title: "عضویت در کانال", reward: 200, done: true },
  { id: 2, icon: "🎯", title: "۳ پیش‌بینی درست بزن", reward: 350, done: false, prog: "۱/۳" },
  { id: 3, icon: "⚔️", title: "یک دوئل ببر", reward: 500, done: false },
  { id: 4, icon: "👥", title: "دعوت یک دوست فعال", reward: 800, done: false },
];

export function Home({ go }: { go: (t: Tab) => void }) {
  const { p, credit } = usePlayer();
  const [claimed, setClaimed] = useState(false);

  return (
    <div className="vscroll h-full pb-28">
      <header className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-brand/20 border-2 border-brand/50 flex items-center justify-center text-brand font-bold">
            ب
          </div>
          <div>
            <div className="text-[15px] font-bold">{p.name}</div>
            <div className="mono text-[11px] text-t3">Elo {p.elo} · رتبه ۲۴۷</div>
          </div>
        </div>
        <button className="h-9 w-9 rounded-full bg-s2 border border-line text-t2">
          ⚙
        </button>
      </header>

      {/* موجودی */}
      <div className="px-4 mt-5 text-center">
        <div className="text-[12px] text-t2">موجودی توکن</div>
        <div className="mono text-[46px] font-extrabold leading-none mt-1 text-brand">
          {Math.round(p.balance).toLocaleString("en-US")}
        </div>
        <div className="text-[11px] text-t3 mt-1.5">
          امتیاز فصل ۱ · <span className="mono">{p.points.toLocaleString("en-US")}</span>
        </div>
      </div>

      {/* انرژی */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-t2">⚡ انرژی</span>
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

      <div className="px-4 mt-5 grid grid-cols-2 gap-3">
        <Button size="lg" onClick={() => go("play")}>
          ⚡ بازی سریع
        </Button>
        <Button size="lg" variant="surface" onClick={() => go("duel")}>
          ⚔️ دوئل
        </Button>
      </div>

      {/* آمار */}
      <div className="px-4 mt-4">
        <Card className="p-4 flex">
          <div className="flex-1 text-center">
            <div className="mono text-[20px] font-bold text-brand">
              {accuracy(p)}%
            </div>
            <div className="text-[11px] text-t3 mt-0.5">دقت</div>
          </div>
          <div className="w-px bg-line" />
          <div className="flex-1 text-center">
            <div className="mono text-[20px] font-bold">
              {p.wins}<span className="text-t3 text-[14px]">/{p.wins + p.losses}</span>
            </div>
            <div className="text-[11px] text-t3 mt-0.5">برد</div>
          </div>
          <div className="w-px bg-line" />
          <div className="flex-1 text-center">
            <div className="mono text-[20px] font-bold text-warn">🔥 {p.streak}</div>
            <div className="text-[11px] text-t3 mt-0.5">استریک</div>
          </div>
        </Card>
      </div>

      {/* جایزه‌ی روزانه */}
      <div className="px-4">
        <SectionTitle>جایزه‌ی روزانه</SectionTitle>
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
              credit(150, "جایزه‌ی روزانه");
              setClaimed(true);
            }}
          >
            {claimed ? "دریافت شد ✓" : "دریافت ۱۵۰ ◈"}
          </Button>
        </Card>
      </div>

      {/* رفرال */}
      <div className="px-4">
        <SectionTitle>دعوت دوستان</SectionTitle>
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
              <div className="text-[14px] font-bold">۲ دوست فعال دعوت کن</div>
              <div className="text-[12px] text-t2 mt-1">
                تا پاداش ۲٬۰۰۰ ◈ باز شود
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-s2 border border-line px-3 h-11">
            <span className="mono text-[11px] text-t3 flex-1 truncate">
              t.me/yourbot?start=ref_8241
            </span>
            <button className="text-brand text-[13px] font-bold">کپی</button>
          </div>
        </Card>
      </div>

      {/* تسک‌ها */}
      <div className="px-4">
        <SectionTitle
          action={<span className="text-[12px] text-brand">همه</span>}
        >
          تسک‌های امروز
        </SectionTitle>
        <div className="space-y-2">
          {TASKS.map((t) => (
            <Card key={t.id} className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-s2 flex items-center justify-center text-[18px]">
                {t.icon}
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold">{t.title}</div>
                <div className="mono text-[11px] text-brand mt-0.5">
                  +{t.reward} ◈ {t.prog && <span className="text-t3">· {t.prog}</span>}
                </div>
              </div>
              {t.done ? (
                <span className="text-up text-[13px] font-bold">✓ انجام شد</span>
              ) : (
                <Button size="sm">شروع</Button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
