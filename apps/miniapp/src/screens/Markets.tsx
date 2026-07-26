import { useEffect, useState } from "react";
import { BalancePill, Card, Chip } from "../components/ui";
import { EventIcon } from "../components/EventIcon";
import { MarketDetail } from "./MarketDetail";
import {
  CATEGORIES,
  featuredMarket,
  fetchLive,
  fmtMult,
  fmtUsd,
  getSnapshot,
  outcomeLabel,
  timeLeft,
  type Category,
  type PMEvent,
  type Source,
} from "../lib/polymarket";
import { usePlayer } from "../lib/store";

export function Markets() {
  const { p } = usePlayer();
  const [cat, setCat] = useState<Category>("trending");
  const [events, setEvents] = useState<PMEvent[]>(() => getSnapshot("trending"));
  const [source, setSource] = useState<Source>("snapshot");
  const [refreshing, setRefreshing] = useState(true);
  const [open, setOpen] = useState<PMEvent | null>(null);

  useEffect(() => {
    let alive = true;
    setEvents(getSnapshot(cat));
    setSource("snapshot");
    setRefreshing(true);
    fetchLive(cat).then((live) => {
      if (!alive) return;
      if (live) {
        setEvents(live);
        setSource("live");
      }
      setRefreshing(false);
    });
    return () => {
      alive = false;
    };
  }, [cat]);

  if (open) return <MarketDetail event={open} onBack={() => setOpen(null)} />;

  return (
    <div className="vscroll h-full pb-28">
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight">بازارها</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                refreshing ? "bg-warn live-dot" : source === "live" ? "bg-up" : "bg-t3"
              }`}
            />
            <span className="text-t3 text-[11px]">
              داده از Polymarket ·{" "}
              {refreshing
                ? "در حال تازه‌سازی"
                : source === "live"
                  ? "زنده"
                  : "ذخیره‌شده"}
            </span>
          </div>
        </div>
        <BalancePill value={p.balance} />
      </header>

      <div className="hscroll flex gap-2 px-4 pb-4">
        {CATEGORIES.map((c) => (
          <Chip key={c.key} active={c.key === cat} onClick={() => setCat(c.key)}>
            {c.label}
          </Chip>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {events.map((e) => (
          <EventCard key={e.id} event={e} onOpen={() => setOpen(e)} />
        ))}

        {events.length === 0 && (
          <Card className="p-8 text-center">
            <div className="text-[32px]">🗂</div>
            <div className="text-[14px] text-t2 mt-2">
              بازاری در این دسته پیدا نشد
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function EventCard({ event, onOpen }: { event: PMEvent; onOpen: () => void }) {
  const top = featuredMarket(event.markets);
  // بازاری که تقریباً حل شده (۹۵٪ به ۵٪) دکمه‌ی شرط نمی‌گیرد
  const settled = !!top && Math.abs((top.outcomes[0]?.price ?? 0) - 0.5) > 0.45;
  const left = timeLeft(event.endDate);

  return (
    <Card className="p-4" onClick={onOpen}>
      <div className="flex items-start gap-3">
        <EventIcon src={event.icon} name={event.title} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {event.live && (
              <span className="flex items-center gap-1 rounded-full bg-live/15 px-2 py-0.5">
                <span className="live-dot h-1 w-1 rounded-full bg-live" />
                <span className="text-live text-[9px] font-bold">LIVE</span>
              </span>
            )}
            <span className="text-[10px] text-t3">
              <span dir="ltr" className="mono">
                {fmtUsd(event.volume24h)}
              </span>{" "}
              · ۲۴س
            </span>
            {left && <span className="text-[10px] text-t3">· {left}</span>}
          </div>
          <div
            dir="auto"
            className="text-[15px] font-bold leading-snug line-clamp-2"
          >
            {event.title}
          </div>
        </div>
        <div className="text-t3 text-[16px] shrink-0 self-center">‹</div>
      </div>

      {top && settled && (
        <div className="mt-3 rounded-xl bg-s2 px-3 py-3.5 flex items-center justify-center gap-2">
          <span className="text-t3 text-[13px]">◷</span>
          <span className="text-t3 text-[12px]">
            نتیجه تقریباً مشخص شده — در انتظار حل‌وفصل
          </span>
        </div>
      )}

      {top && !settled && (
        <div className="mt-3 rounded-xl bg-s2 p-3">
          <div className="flex items-center justify-between mb-2">
            <span dir="auto" className="text-[12px] text-t2 truncate">
              {top.label ?? top.question}
            </span>
            <span className="mono text-[13px] font-bold text-brand shrink-0 ms-2">
              {Math.round(top.outcomes[0].price * 100)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {top.outcomes.slice(0, 2).map((o, i) => (
              <div
                key={o.name}
                className={`h-10 rounded-lg flex items-center justify-center gap-1.5 px-2 text-[12px] font-bold truncate ${
                  i === 0
                    ? "bg-up/12 border border-up/30 text-up"
                    : "bg-down/12 border border-down/30 text-down"
                }`}
              >
                <span dir="auto" className="truncate">
                  {outcomeLabel(o.name)}
                </span>
                <span className="mono opacity-70 shrink-0">
                  {fmtMult(o.price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {event.markets.length > 1 && !settled && (
        <div className="text-[11px] text-t3 mt-2.5 text-center">
          + {event.markets.length - 1} نتیجه‌ی دیگر
        </div>
      )}
    </Card>
  );
}
