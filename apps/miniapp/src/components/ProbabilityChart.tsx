import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { PMPoint } from "../lib/polymarket";

export type Series = { label: string; points: PMPoint[] };

export const SERIES_COLORS = [
  "#c6f73c",
  "#16c784",
  "#f0616d",
  "#3b82f6",
  "#f5a524",
];

const RANGES = [
  { key: "1h", label: "۱ ساعت", secs: 3600 },
  { key: "1d", label: "۱ روز", secs: 86400 },
  { key: "7d", label: "۷ روز", secs: 604800 },
  { key: "all", label: "همه", secs: Infinity },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

export function ProbabilityChart({
  series,
  height = 190,
}: {
  series: Series[];
  height?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<RangeKey>("7d");

  const shown = useMemo(() => series.slice(0, SERIES_COLORS.length), [series]);

  const sliced = useMemo(() => {
    const secs = RANGES.find((r) => r.key === range)!.secs;
    if (secs === Infinity) return shown;
    const newest = Math.max(
      0,
      ...shown.flatMap((s) => (s.points.length ? [s.points.at(-1)![0]] : []))
    );
    const cutoff = newest - secs;
    return shown.map((s) => ({
      ...s,
      points: s.points.filter((p) => p[0] >= cutoff),
    }));
  }, [shown, range]);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "#5e5e68",
        fontSize: 10,
        fontFamily: "ui-monospace, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "#1c1c1f", style: 1 },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      localization: {
        priceFormatter: (v: number) => `${Math.round(v)}%`,
      },
      timeScale: { borderVisible: false, timeVisible: false, rightOffset: 2 },
      crosshair: {
        horzLine: { visible: false },
        vertLine: { color: "#3a3a40", width: 1, style: 2, labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
    });

    sliced.forEach((s, i) => {
      if (s.points.length < 2) return;
      const line = c.addLineSeries({
        color: SERIES_COLORS[i],
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerRadius: 3,
      });
      // زمان‌ها باید یکتا و صعودی باشند
      const seen = new Set<number>();
      line.setData(
        s.points
          .filter(([t]) => (seen.has(t) ? false : (seen.add(t), true)))
          .map(([t, p]) => ({ time: t as UTCTimestamp, value: p * 100 }))
      );
    });

    c.timeScale().fitContent();
    chart.current = c;

    const ro = new ResizeObserver(() => {
      if (box.current) c.applyOptions({ width: box.current.clientWidth });
    });
    ro.observe(box.current);

    return () => {
      ro.disconnect();
      c.remove();
      chart.current = null;
    };
  }, [sliced, height]);

  return (
    <div>
      {/* راهنما */}
      <div className="hscroll flex gap-3 px-4 pb-2">
        {shown.map((s, i) => {
          const last = s.points.at(-1)?.[1] ?? 0;
          return (
            <div key={s.label} className="flex items-center gap-1.5 shrink-0">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: SERIES_COLORS[i] }}
              />
              <span
                dir="auto"
                className="text-[11px] text-t2 max-w-[92px] truncate"
              >
                {s.label}
              </span>
              <span className="mono text-[11px] font-bold text-t1">
                {Math.round(last * 100)}%
              </span>
            </div>
          );
        })}
      </div>

      <div ref={box} className="w-full" style={{ height }} />

      {/* بازه‌ی زمانی */}
      <div className="flex gap-1.5 px-4 pt-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition-colors ${
              range === r.key ? "bg-s3 text-t1" : "text-t3 active:text-t2"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
