import { useEffect, useState } from "react";
import { BalancePill, Button, Card } from "../components/ui";
import { EventIcon } from "../components/EventIcon";
import { ProbabilityChart, type Series } from "../components/ProbabilityChart";
import {
  fmtDate,
  fmtMult,
  fmtUsd,
  loadHistory,
  localHistory,
  outcomeLabel,
  sortByCompetitiveness,
  timeLeft,
  type PMEvent,
  type PMMarket,
  type PMOutcome,
} from "../lib/polymarket";
import { usePlayer } from "../lib/store";

const STAKES = [50, 100, 250, 500];

type Pick = { market: PMMarket; outcome: PMOutcome; index: number };

export function MarketDetail({
  event,
  onBack,
}: {
  event: PMEvent;
  onBack: () => void;
}) {
  const { p, credit } = usePlayer();
  const [pick, setPick] = useState<Pick | null>(null);
  const [stake, setStake] = useState(100);
  const [placed, setPlaced] = useState<string | null>(null);
  const [showDesc, setShowDesc] = useState(false);

  const left = timeLeft(event.endDate);
  const markets = sortByCompetitiveness(event.markets);

  // Snapshot first, then swapped for live data in the background
  const [series, setSeries] = useState<Series[]>(() =>
    markets
      .slice(0, 5)
      .map((m) => {
        const points = localHistory(m.id);
        return points && points.length > 1
          ? { label: m.label ?? m.question, points }
          : null;
      })
      .filter((x): x is Series => x !== null)
  );

  useEffect(() => {
    let alive = true;
    Promise.all(
      markets.slice(0, 5).map((m) =>
        loadHistory(m.id, m.tokenIds[0]).then((points) =>
          points && points.length > 1
            ? { label: m.label ?? m.question, points }
            : null
        )
      )
    ).then((r) => {
      const next = r.filter((x): x is Series => x !== null);
      if (alive && next.length) setSeries(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const confirm = () => {
    if (!pick || p.balance < stake) return;
    credit(-stake, `Prediction: ${pick.outcome.name}`);
    setPlaced(
      `${stake} \u25c8 on \u201c${outcomeLabel(
        pick.outcome.name
      )}\u201d placed \u2014 pays ${Math.round(
        stake / Math.max(0.01, pick.outcome.price)
      ).toLocaleString("en-US")} \u25c8`
    );
    setPick(null);
  };

  return (
    <div className="vscroll h-full pb-28">
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-t2 text-[14px] font-semibold"
        >
          <span className="text-[17px]">\u2190</span> Back
        </button>
        <BalancePill value={p.balance} />
      </header>

      <div className="px-4">
        <div className="flex items-center gap-2 mb-2">
          {event.live && (
            <span className="rounded-full bg-live/15 text-live text-[10px] font-bold px-2 py-0.5">
              ● LIVE
            </span>
          )}
          <span className="text-brand text-[11px] font-bold">Open</span>
          {left && <span className="text-t3 text-[11px]">· {left}</span>}
        </div>

        <div className="flex items-start gap-3">
          <EventIcon src={event.icon} name={event.title} size={52} />
          <div className="flex-1 min-w-0">
            <h1 dir="auto" className="text-[19px] font-extrabold leading-snug">
              {event.title}
            </h1>
            <p className="text-t3 text-[12px] mt-1">
              Resolves {fmtDate(event.endDate)}
            </p>
          </div>
        </div>
      </div>

      {/* probability chart */}
      {series.length > 0 && (
        <div className="px-4 mt-4">
          <Card className="py-3 overflow-hidden">
            <ProbabilityChart series={series} />
          </Card>
        </div>
      )}

      {/* stats */}
      <div className="px-4 mt-4">
        <Card className="p-4 grid grid-cols-2 gap-y-4">
          <Metric label="24h volume" value={fmtUsd(event.volume24h)} />
          <Metric label="Total volume" value={fmtUsd(event.volume)} />
          <Metric label="Liquidity" value={fmtUsd(event.liquidity)} />
          <Metric label="Open interest" value={fmtUsd(event.openInterest)} />
        </Card>
      </div>

      {/* outcomes */}
      <div className="px-4 mt-4">
        <h2 className="text-[17px] font-extrabold mb-3">Outcomes</h2>
        <div className="space-y-2">
          {markets.map((m) => {
            const top = m.outcomes[0];
            return (
              <Card key={m.id} className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <EventIcon src={event.icon} name={m.label ?? m.question} size={34} />
                  <div className="flex-1 min-w-0">
                    <div dir="auto" className="text-[14px] font-semibold leading-snug">
                      {m.label ?? m.question}
                    </div>
                    <div className="text-[10px] text-t3 mt-1">
                      Vol <span className="mono">{fmtUsd(m.volume)}</span>
                    </div>
                  </div>
                  <div className="mono text-[20px] font-extrabold text-brand shrink-0">
                    {Math.round(top.price * 100)}%
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2.5">
                  {m.outcomes.slice(0, 2).map((o, i) => {
                    const on =
                      pick?.market.id === m.id && pick.index === i;
                    const good = i === 0;
                    return (
                      <button
                        key={o.name}
                        onClick={() =>
                          setPick({ market: m, outcome: o, index: i })
                        }
                        className={`h-11 rounded-xl border text-[13px] font-bold truncate px-2 transition-colors ${
                          good
                            ? on
                              ? "bg-up/30 border-up text-up"
                              : "bg-up/10 border-up/35 text-up active:bg-up/20"
                            : on
                              ? "bg-down/30 border-down text-down"
                              : "bg-down/10 border-down/35 text-down active:bg-down/20"
                        }`}
                      >
                        {outcomeLabel(o.name)}{" "}
                        <span className="mono opacity-70">
                          {fmtMult(o.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* source */}
      <div className="px-4 mt-4">
        <Card className="p-4">
          <button
            onClick={() => setShowDesc((s) => !s)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-[17px] font-extrabold">Details</h2>
            <span className="text-t3">{showDesc ? "▲" : "▼"}</span>
          </button>

          <div className="mt-3 space-y-2.5">
            <Row label="Data source" value="Polymarket" accent />
            <Row label="Resolution" value="UMA Oracle" />
            {event.resolutionSource && (
              <Row label="Reference" value={event.resolutionSource} />
            )}
          </div>

          {showDesc && event.description && (
            <p
              dir="auto"
              className="text-[12px] text-t2 leading-relaxed mt-4 pt-4 border-t border-line"
            >
              {event.description}
            </p>
          )}
        </Card>
      </div>

      <p className="px-4 mt-3 text-[11px] text-t3 leading-relaxed">
        Prices and resolutions come from Polymarket. Your prediction is placed
        in our internal pool with game tokens, not on Polymarket.
      </p>

      {/* confirm sheet */}
      {pick && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 px-4 pb-6">
          <Card className="w-full max-w-md p-5 slideup">
            <div dir="auto" className="text-[12px] text-t3">
              {pick.market.label ?? pick.market.question}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span
                className={`text-[20px] font-extrabold ${
                  pick.index === 0 ? "text-up" : "text-down"
                }`}
              >
                {outcomeLabel(pick.outcome.name)}
              </span>
              <span className="mono text-[16px] font-bold text-t2">
                {fmtMult(pick.outcome.price)}
              </span>
            </div>

            <div className="text-[12px] text-t2 mt-4 mb-2">Amount</div>
            <div className="hscroll flex gap-2">
              {STAKES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStake(s)}
                  className={`shrink-0 rounded-full px-4 h-9 text-[13px] font-semibold ${
                    s === stake ? "bg-t1 text-bg" : "bg-s2 text-t2 border border-line"
                  }`}
                >
                  <span className="mono">{s}</span> ◈
                </button>
              ))}
            </div>

            <div className="flex justify-between mt-4 rounded-xl bg-s2 p-3">
              <span className="text-[12px] text-t2">Potential payout</span>
              <span className="mono text-[15px] font-bold text-brand">
                {Math.round(
                  stake / Math.max(0.01, pick.outcome.price)
                ).toLocaleString("en-US")}{" "}
                ◈
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button variant="surface" size="lg" onClick={() => setPick(null)}>
                Cancel
              </Button>
              <Button size="lg" disabled={p.balance < stake} onClick={confirm}>
                {p.balance < stake ? "Low balance" : "Place"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {placed && (
        <div className="fixed inset-x-0 bottom-24 z-40 px-4">
          <div
            onClick={() => setPlaced(null)}
            className="rounded-2xl bg-brand text-bg px-4 py-3 text-[13px] font-bold text-center slideup"
          >
            {placed}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-t3">{label}</div>
      <div className="mono text-[17px] font-bold mt-0.5">{value}</div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13px] text-t2 shrink-0">{label}</span>
      <span
        className={`mono text-[12px] font-bold text-right truncate ${
          accent ? "text-brand" : "text-t1"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
