import { useMemo, useState } from "react";
import { BalancePill, Button, Card } from "../../components/ui";
import { EventIcon } from "../../components/EventIcon";
import {
  CATEGORIES,
  categoryLabel,
  fmtMult,
  getSnapshot,
  multiplier,
  outcomeLabel,
  sortByCompetitiveness,
  type PMEvent,
} from "../../lib/polymarket";
import { usePlayer } from "../../lib/store";
import { useFullScreen } from "../../lib/chrome";
import { GameHeader } from "./GameHeader";

const STAKES = [25, 50, 100, 250];
const MAX_LEGS = 6;

type Leg = {
  key: string;
  eventId: string;
  icon: string | null;
  title: string;
  market: string;
  outcome: string;
  price: number;
};

/** One pickable leg per event: its most competitive market, both sides */
function candidates(): { event: PMEvent; legs: Leg[] }[] {
  const seen = new Set<string>();
  const out: { event: PMEvent; legs: Leg[] }[] = [];

  for (const c of CATEGORIES) {
    for (const e of getSnapshot(c.key)) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const m = sortByCompetitiveness(e.markets)[0];
      if (!m) continue;
      // A market already at 99/1 adds no real risk and no real payout
      if (Math.abs((m.outcomes[0]?.price ?? 0) - 0.5) > 0.45) continue;

      out.push({
        event: e,
        legs: m.outcomes.slice(0, 2).map((o) => ({
          key: `${m.id}:${o.name}`,
          eventId: e.id,
          icon: e.icon,
          title: e.title,
          market: m.label ?? m.question,
          outcome: o.name,
          price: o.price,
        })),
      });
    }
  }
  return out;
}

export function Parlay({ onBack }: { onBack: () => void }) {
  useFullScreen();
  const { p, credit } = usePlayer();
  const [legs, setLegs] = useState<Leg[]>([]);
  const [stake, setStake] = useState(50);
  const [placed, setPlaced] = useState<string | null>(null);

  const pool = useMemo(candidates, []);

  const toggle = (leg: Leg) => {
    setLegs((cur) => {
      if (cur.some((l) => l.key === leg.key)) {
        return cur.filter((l) => l.key !== leg.key);
      }
      // one leg per event — the two sides of a market cancel each other out
      const without = cur.filter((l) => l.eventId !== leg.eventId);
      if (without.length >= MAX_LEGS) return cur;
      return [...without, leg];
    });
  };

  const combined = legs.reduce((a, l) => a * multiplier(l.price), 1);
  const payout = Math.round(stake * combined);
  const chance = legs.reduce((a, l) => a * l.price, 1);

  const place = () => {
    if (legs.length < 2 || p.balance < stake) return;
    credit(-stake, `Parlay · ${legs.length} legs`);
    setPlaced(
      `${legs.length}-leg ticket placed · ${stake} ◈ to win ${payout.toLocaleString(
        "en-US"
      )} ◈`
    );
    setLegs([]);
    setTimeout(() => setPlaced(null), 4000);
  };

  return (
    <div className="h-full flex flex-col pb-1">
      <GameHeader title="Parlay" onBack={onBack}>
        <BalancePill value={p.balance} />
      </GameHeader>

      <div className="px-4 pb-2 shrink-0">
        <p className="text-[12px] text-t2">
          Stack 2 to {MAX_LEGS} calls into one ticket. Every leg has to land —
          the odds multiply.
        </p>
      </div>

      {/* pickable legs */}
      <div className="vscroll flex-1 px-4 space-y-2">
        {pool.map(({ event, legs: opts }) => (
          <Card key={event.id} className="p-3">
            <div className="flex items-start gap-2.5">
              <EventIcon src={event.icon} name={event.title} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold leading-snug line-clamp-2">
                  {event.title}
                </div>
                <div className="text-[10px] text-t3 mt-0.5 truncate">
                  {opts[0]?.market} · {categoryLabel(event.category ?? "")}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2.5">
              {opts.map((leg, i) => {
                const on = legs.some((l) => l.key === leg.key);
                const good = i === 0;
                return (
                  <button
                    key={leg.key}
                    onClick={() => toggle(leg)}
                    className={`h-10 rounded-xl border text-[12px] font-bold truncate px-2 transition-colors ${
                      good
                        ? on
                          ? "bg-up text-bg border-up"
                          : "bg-up/12 text-up border-up/35 active:bg-up/25"
                        : on
                          ? "bg-down text-bg border-down"
                          : "bg-down/12 text-down border-down/35 active:bg-down/25"
                    }`}
                  >
                    {outcomeLabel(leg.outcome)}{" "}
                    <span className="mono opacity-75">{fmtMult(leg.price)}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
        <div className="h-2" />
      </div>

      {/* ticket */}
      <div className="shrink-0 border-t border-line bg-s1">
        {legs.length > 0 && (
          <div className="vscroll max-h-[132px] px-4 pt-3 space-y-1.5">
            {legs.map((l) => (
              <div key={l.key} className="flex items-center gap-2">
                <button
                  onClick={() => toggle(l)}
                  className="text-t3 text-[13px] shrink-0 w-4"
                >
                  ✕
                </button>
                <span className="flex-1 min-w-0 truncate text-[12px]">
                  <span className="text-t2">{l.market}</span>{" "}
                  <span className="font-bold">{outcomeLabel(l.outcome)}</span>
                </span>
                <span className="mono text-[12px] font-bold text-t2 shrink-0">
                  {fmtMult(l.price)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <div className="text-[10px] text-t3">
                {legs.length} leg{legs.length === 1 ? "" : "s"}
                {legs.length > 1 && (
                  <> · {(chance * 100).toFixed(1)}% chance</>
                )}
              </div>
              <div className="mono text-[24px] font-extrabold text-brand leading-none mt-0.5">
                ×{combined >= 100 ? Math.round(combined) : combined.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-t3">To win</div>
              <div className="mono text-[20px] font-bold leading-none mt-0.5">
                {legs.length >= 2 ? payout.toLocaleString("en-US") : "—"} ◈
              </div>
            </div>
          </div>

          <div className="hscroll flex gap-2 mb-2.5">
            {STAKES.map((s) => (
              <button
                key={s}
                onClick={() => setStake(s)}
                className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-bold ${
                  s === stake ? "bg-t1 text-bg" : "bg-s2 text-t2 border border-line"
                }`}
              >
                <span className="mono">{s}</span> ◈
              </button>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={legs.length < 2 || p.balance < stake}
            onClick={place}
          >
            {legs.length < 2
              ? "Pick at least 2 legs"
              : p.balance < stake
                ? "Not enough balance"
                : `Place ticket · ${stake} ◈`}
          </Button>
        </div>
      </div>

      {placed && (
        <div className="fixed inset-x-4 bottom-6 z-40">
          <div className="rounded-2xl bg-brand text-bg px-4 py-3 text-[13px] font-bold text-center slideup">
            {placed}
          </div>
        </div>
      )}
    </div>
  );
}
