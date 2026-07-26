import { useEffect, useRef } from "react";
import {
  createChart,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import { getFeed, type AssetId } from "../lib/feed";

export type Marker = {
  price: number;
  color: string;
  title: string;
  dashed?: boolean;
};

export function Chart({
  asset,
  height = 220,
  lines = [],
  tone = "brand",
}: {
  asset: AssetId;
  height?: number;
  lines?: Marker[];
  tone?: "brand" | "up" | "down";
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Area"> | null>(null);
  const priceLines = useRef<IPriceLine[]>([]);

  const color =
    tone === "up" ? "#16c784" : tone === "down" ? "#f0616d" : "#c6f73c";

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
        horzLines: { color: "#1c1c1f" },
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.15, bottom: 0.15 } },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 3,
      },
      crosshair: { horzLine: { visible: false }, vertLine: { visible: false } },
      handleScroll: false,
      handleScale: false,
    });
    const s = c.addAreaSeries({
      lineColor: color,
      topColor: `${color}44`,
      bottomColor: `${color}00`,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const feed = getFeed(asset);
    s.setData(
      feed.history().map((t) => ({
        time: Math.floor(t.t / 1000) as UTCTimestamp,
        value: t.p,
      }))
    );
    c.timeScale().fitContent();

    chart.current = c;
    series.current = s;

    const off = feed.sub((t) =>
      s.update({
        time: Math.floor(t.t / 1000) as UTCTimestamp,
        value: t.p,
      })
    );

    const ro = new ResizeObserver(() => {
      if (box.current) c.applyOptions({ width: box.current.clientWidth });
    });
    ro.observe(box.current);

    return () => {
      off();
      ro.disconnect();
      c.remove();
      chart.current = null;
      series.current = null;
      priceLines.current = [];
    };
  }, [asset, height, color]);

  // reference lines (lock price, duel shots)
  useEffect(() => {
    const s = series.current;
    if (!s) return;
    priceLines.current.forEach((l) => s.removePriceLine(l));
    priceLines.current = lines.map((l) =>
      s.createPriceLine({
        price: l.price,
        color: l.color,
        lineWidth: 1,
        lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
        title: l.title,
      })
    );
  }, [lines]);

  return <div ref={box} className="w-full" style={{ height }} />;
}
