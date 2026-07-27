import { useEffect, useState } from "react";
import { BalancePill, Card, Chip } from "../components/ui";
import { EventIcon } from "../components/EventIcon";
import { MarketDetail } from "./MarketDetail";
import {
  byLiveliness,
  CATEGORIES,
  categoryCount,
  categoryLabel,
  fetchLive,
  fmtUsd,
  getSnapshot,
  outcomeLabel,
  sortByCompetitiveness,
  timeLeft,
  type Category,
  type PMEvent,
  type PMMarket,
} from "../lib/polymarket";
import { usePlayer } from "../lib/store";

type Tab = "trending" | Category;

export function Markets() {
  const { p } = usePlayer();
  const [tab, setTab] = useState<Tab>("trending");
  const [open, setOpen] = useState<PMEvent | null>(null);
  const [query, setQuery] = useState("");

  if (open) return <MarketDetail event={open} onBack={() => setOpen(null)} />;

  const searching = query.trim().length > 1;
  const results = searching
    ? CATEGORIES.flatMap((c) => getSnapshot(c.key)).filter((e) =>
        e.title.toLowerCase().includes(query.trim().toLowerCase())
      )
    : [];

  return (
    <div className="vscroll h-full pb-28">
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="text-[26px] font-extrabold">Markets</h1>
        <BalancePill value={p.balance} />
      </header>

      {/* tabs */}
      <div className="hscroll flex gap-2 px-4 pb-3">
        <Chip active={tab === "trending"} onClick={() => setTab("trending")}>
          Trending
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} active={tab === c.key} onClick={() => setTab(c.key)}>
            {c.label} {c.emoji}
          </Chip>
        ))}
      </div>

      {/* search */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2.5 rounded-2xl bg-s2 border border-line h-12 px-4">
          <span className="text-t3 text-[15px]">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Market name or Polymarket link"
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-t3"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-t3 text-[15px]">
              ✕
            </button>
          )}
        </div>
      </div>

      {searching ? (
        <div className="px-4 space-y-3">
          <div className="text-[12px] text-t3">
            {results.length} results for \u201c{query.trim()}\u201d
          </div>
          {results.map((e) => (
            <EventCard key={e.id} event={e} onOpen={() => setOpen(e)} wide />
          ))}
          {results.length === 0 && (
            <Card className="p-8 text-center">
              <div className="text-[30px]">🔍</div>
              <div className="text-[14px] text-t2 mt-2">Nothing found</div>
            </Card>
          )}
        </div>
      ) : tab === "trending" ? (
        <>
          <FeatureBanner />
          {CATEGORIES.map((c) => (
            <Section key={c.key} cat={c.key} onOpen={setOpen} onAll={setTab} />
          ))}
        </>
      ) : (
        <CategoryList cat={tab} onOpen={setOpen} />
      )}
    </div>
  );
}

/* ---------- banner ---------- */

function FeatureBanner() {
  return (
    <div className="px-4 pb-5">
      <div className="relative overflow-hidden rounded-[18px] border border-brand/25 bg-gradient-to-l from-brand/18 to-transparent p-4">
        <div className="text-brand text-[10px] font-extrabold tracking-widest">
          ⚡ QUICK PLAY
        </div>
        <div className="text-[18px] font-extrabold mt-1.5">
          30 seconds, up or down
        </div>
        <div className="text-t2 text-[12px] mt-0.5">
          On ETH and BTC, right now
        </div>
        <div className="absolute -left-3 -bottom-4 text-[80px] opacity-10 leading-none">
          📈
        </div>
      </div>
    </div>
  );
}

/* ---------- section carousel ---------- */

function Section({
  cat,
  onOpen,
  onAll,
}: {
  cat: Category;
  onOpen: (e: PMEvent) => void;
  onAll: (t: Tab) => void;
}) {
  const [events, setEvents] = useState<PMEvent[]>(() =>
    byLiveliness(getSnapshot(cat))
  );

  useEffect(() => {
    let alive = true;
    fetchLive(cat).then((live) => {
      if (alive && live) setEvents(byLiveliness(live));
    });
    return () => {
      alive = false;
    };
  }, [cat]);

  if (!events.length) return null;
  const count = categoryCount(cat);

  return (
    <section className="pb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-[22px] font-extrabold">
          {categoryLabel(cat)}{" "}
          {count > 0 && (
            <span className="mono text-t3 text-[18px]">
              {count.toLocaleString("en-US")}
            </span>
          )}
        </h2>
        <button
          onClick={() => onAll(cat)}
          className="flex items-center gap-1.5 rounded-full border border-line bg-s2 h-9 px-3.5 text-[12px] font-semibold text-t2"
        >
          All <span className="text-[13px]">›</span>
        </button>
      </div>

      <div className="hscroll flex gap-3 px-4 pb-1 items-stretch">
        {events.map((e) => (
          <div key={e.id} className="w-[310px] shrink-0">
            <EventCard event={e} onOpen={() => onOpen(e)} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- single category list ---------- */

function CategoryList({
  cat,
  onOpen,
}: {
  cat: Category;
  onOpen: (e: PMEvent) => void;
}) {
  const [events, setEvents] = useState<PMEvent[]>(() =>
    byLiveliness(getSnapshot(cat))
  );

  useEffect(() => {
    let alive = true;
    setEvents(byLiveliness(getSnapshot(cat)));
    fetchLive(cat).then((live) => {
      if (alive && live) setEvents(byLiveliness(live));
    });
    return () => {
      alive = false;
    };
  }, [cat]);

  return (
    <div className="px-4 space-y-3">
      <div className="text-[12px] text-t3">
        <span className="mono">
          {categoryCount(cat).toLocaleString("en-US")}
        </span>{" "}
        open markets on Polymarket
      </div>
      {events.map((e) => (
        <EventCard key={e.id} event={e} onOpen={() => onOpen(e)} wide />
      ))}
    </div>
  );
}

/* ---------- event card ---------- */

function EventCard({
  event,
  onOpen,
  wide,
}: {
  event: PMEvent;
  onOpen: () => void;
  wide?: boolean;
}) {
  const rows = sortByCompetitiveness(event.markets).slice(0, 2);
  const left = timeLeft(event.endDate);

  return (
    <Card
      onClick={onOpen}
      className={`p-4 flex flex-col ${wide ? "" : "h-full"}`}
    >
      {/* header */}
      <div className="flex items-start gap-3">
        <EventIcon src={event.icon} name={event.title} size={44} />
        <div
          dir="auto"
          className="flex-1 min-w-0 text-[14px] font-bold leading-snug line-clamp-2"
        >
          {event.title}
        </div>
        {event.live && (
          <span className="flex items-center gap-1 rounded-full bg-live px-2 py-1 shrink-0">
            <span className="live-dot h-1 w-1 rounded-full bg-white" />
            <span className="text-white text-[9px] font-extrabold">LIVE</span>
          </span>
        )}
      </div>

      {/* outcome rows */}
      <div className="mt-3.5 space-y-2.5 flex-1">
        {rows.map((m) => (
          <OutcomeRow key={m.id} market={m} />
        ))}
      </div>

      {/* footer */}
      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-line">
        <span className="text-[11px] text-t3">
          Vol <span className="mono">{fmtUsd(event.volume)}</span> ·{" "}
          {categoryLabel(event.category ?? "")}
        </span>
        {left && (
          <span className="text-[11px] text-t3 flex items-center gap-1">
            <span className="text-[10px]">◷</span> {left}
          </span>
        )}
      </div>
    </Card>
  );
}

function OutcomeRow({ market }: { market: PMMarket }) {
  const [a, b] = market.outcomes;
  const pct = Math.round((a?.price ?? 0) * 100);
  const settled = Math.abs((a?.price ?? 0) - 0.5) > 0.45;

  return (
    <div className="flex items-center gap-2">
      <span
        dir="auto"
        className="flex-1 min-w-0 truncate text-[13px] font-semibold"
      >
        {market.label ?? market.question}
      </span>
      <span className="mono text-[13px] font-bold text-t1 shrink-0 w-9 text-right">
        {pct}%
      </span>

      {settled ? (
        <span className="text-[10px] text-t3 shrink-0 w-[108px] text-center">
          Awaiting resolution
        </span>
      ) : (
        <div className="flex gap-1.5 shrink-0">
          <button className="h-8 w-[52px] rounded-lg bg-up/15 text-up text-[12px] font-bold active:bg-up/30 truncate px-1">
            <span dir="auto">{short(outcomeLabel(a?.name ?? ""))}</span>
          </button>
          <button className="h-8 w-[52px] rounded-lg bg-down/15 text-down text-[12px] font-bold active:bg-down/30 truncate px-1">
            <span dir="auto">{short(outcomeLabel(b?.name ?? ""))}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Long team names do not fit on the pill — abbreviate them */
function short(name: string) {
  if (name.length <= 6) return name;
  const words = name.split(" ").filter(Boolean);
  if (words.length > 1)
    return words
      .map((w) => w[0])
      .join("")
      .slice(0, 4);
  return name.slice(0, 5);
}
