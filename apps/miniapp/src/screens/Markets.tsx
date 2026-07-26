import { useState } from "react";
import { BalancePill, Card, Chip, LiveBadge, SectionTitle } from "../components/ui";
import { usePlayer } from "../lib/store";

const CATS = ["ترند", "فوتبال", "کریپتو", "ای‌اسپورتس", "رویداد"];

const LIVE = [
  {
    league: "لیگ برتر",
    home: "پرسپولیس",
    away: "استقلال",
    score: "1 - 0",
    minute: "۶۷'",
    q: "۱۰ دقیقه‌ی بعد گل می‌شود؟",
    yes: 38,
    no: 62,
  },
  {
    league: "لالیگا",
    home: "رئال",
    away: "بارسا",
    score: "2 - 2",
    minute: "۸۱'",
    q: "کرنر بعدی مال رئال است؟",
    yes: 54,
    no: 46,
  },
];

const MARKETS = [
  { cat: "فوتبال", title: "قهرمان لیگ برتر ۱۴۰۵", opt: "پرسپولیس", pct: 43, vol: "۸۲۰K" },
  { cat: "کریپتو", title: "قیمت اتریوم تا پایان ماه بالای ۳٬۵۰۰ دلار", opt: "بله", pct: 27, vol: "۱.۲M" },
  { cat: "رویداد", title: "قیمت دلار تا پایان هفته زیر ۹۰ هزار", opt: "بله", pct: 61, vol: "۴۴۰K" },
  { cat: "ای‌اسپورتس", title: "برنده‌ی BLAST Bounty — Spirit", opt: "بله", pct: 68, vol: "۵۶۴K" },
];

export function Markets() {
  const { p } = usePlayer();
  const [cat, setCat] = useState(CATS[0]);

  return (
    <div className="vscroll h-full pb-28">
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="text-[26px] font-extrabold">بازارها</h1>
        <BalancePill value={p.balance} />
      </header>

      <div className="hscroll flex gap-2 px-4 pb-3">
        {CATS.map((c) => (
          <Chip key={c} active={c === cat} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="px-4">
        <div className="flex items-center gap-2 rounded-2xl bg-s2 border border-line h-12 px-4">
          <span className="text-t3">⌕</span>
          <span className="text-t3 text-[14px]">جست‌وجوی بازار…</span>
        </div>
      </div>

      {/* زنده */}
      <div className="px-4">
        <SectionTitle action={<LiveBadge />}>در حال پخش</SectionTitle>
      </div>
      <div className="hscroll flex gap-3 px-4">
        {LIVE.map((m, i) => (
          <Card key={i} className="p-4 min-w-[300px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-t3">{m.league}</span>
              <span className="text-[11px] text-live font-bold mono">{m.minute}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[14px] font-bold">{m.home}</span>
              <span className="mono text-[20px] font-extrabold">{m.score}</span>
              <span className="text-[14px] font-bold">{m.away}</span>
            </div>
            <div className="mt-4 rounded-xl bg-s2 p-3">
              <div className="text-[13px] font-semibold mb-2.5">{m.q}</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="h-11 rounded-xl bg-up/12 border border-up/35 active:bg-up/25">
                  <span className="text-up text-[13px] font-bold">بله</span>
                  <span className="mono text-up/70 text-[11px] mr-1.5">
                    {m.yes}%
                  </span>
                </button>
                <button className="h-11 rounded-xl bg-down/12 border border-down/35 active:bg-down/25">
                  <span className="text-down text-[13px] font-bold">خیر</span>
                  <span className="mono text-down/70 text-[11px] mr-1.5">
                    {m.no}%
                  </span>
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* بازارها */}
      <div className="px-4">
        <SectionTitle
          action={<span className="text-[12px] text-t3 mono">۵۰۸ بازار</span>}
        >
          همه‌ی بازارها
        </SectionTitle>
        <div className="space-y-2">
          {MARKETS.map((m, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <span className="text-[10px] text-t3 bg-s2 rounded-md px-2 py-0.5">
                    {m.cat}
                  </span>
                  <div className="text-[14px] font-semibold mt-2 leading-snug">
                    {m.title}
                  </div>
                  <div className="mono text-[11px] text-t3 mt-1.5">
                    حجم {m.vol} ◈
                  </div>
                </div>
                <div className="text-center shrink-0">
                  <div className="mono text-[22px] font-extrabold text-brand">
                    {m.pct}%
                  </div>
                  <div className="text-[10px] text-t3">{m.opt}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button className="h-10 rounded-xl bg-up/12 border border-up/35 text-up text-[13px] font-bold active:bg-up/25">
                  بله <span className="mono opacity-70">×{(100 / m.pct).toFixed(2)}</span>
                </button>
                <button className="h-10 rounded-xl bg-down/12 border border-down/35 text-down text-[13px] font-bold active:bg-down/25">
                  خیر{" "}
                  <span className="mono opacity-70">
                    ×{(100 / (100 - m.pct)).toFixed(2)}
                  </span>
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
