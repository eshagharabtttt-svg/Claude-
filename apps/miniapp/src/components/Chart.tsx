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

/** Ticks arrive faster than one per second; the chart keys on seconds. */
const toPoint = (t: number, p: number) => ({
  time: Math.floor(t / 1000) as UTCTimestamp,
  value: p,
});

export function Chart({
  asset,
  height,
  lines = [],
  tone = "brand",
  fill = true,
}: {
  asset: AssetId;
  height?: number;
  lines?: Marker[];
  tone?: "brand" | "up" | "down";
  fill?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Area"> | null>(null);
  const priceLines = useRef<IPriceLine[]>([]);

  const color =
    tone === "up" ? "#16c784" : tone === "down" ? "#f0616d" : "#c6f73c";
  const colorRef = useRef(color);
  colorRef.current = color;

  useEffect(() => {
    if (!box.current) return;
    const el = box.current;

    const c = createChart(el, {
      height: height ?? el.clientHeight,
      layout: {
        background: { color: "transparent" },
        textColor: "#5e5e68",
        fontSize: 10,
        fontFamily: "ui-monospace, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "#17171a" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 6,
        barSpacing: 4,
      },
      crosshair: { horzLine: { visible: false }, vertLine: { visible: false } },
      handleScroll: false,
      handleScale: false,
    });

    const c0 = colorRef.current;
    const s = c.addAreaSeries({
      lineColor: c0,
      topColor: fill ? `${c0}38` : "transparent",
      bottomColor: `${c0}00`,
      lineWidth: 2,
      priceLineVisible: true,
      priceLineColor: c0,
      priceLineStyle: LineStyle.Dotted,
      lastValueVisible: true,
    });

    const feed = getFeed(asset);
    const seed = () => {
      // Defensive: setData() throws on repeated timestamps, and a feed
      // that ever emits faster than the chart's resolution would produce
      // them. Keep the last sample of each second.
      const out: { time: UTCTimestamp; value: number }[] = [];
      for (const t of feed.history()) {
        const pt = toPoint(t.t, t.p);
        if (out.length && out[out.length - 1].time === pt.time) {
          out[out.length - 1] = pt;
        } else {
          out.push(pt);
        }
      }
      s.setData(out);
    };
    seed();
    c.timeScale().fitContent();

    chart.current = c;
    series.current = s;

    const off = feed.sub((t) => {
      // A reset means the feed swapped source (simulated → Binance) and
      // the whole series has to be replaced, not appended to.
      if (t.reset) seed();
      else s.update(toPoint(t.t, t.p));
    });

    const ro = new ResizeObserver(() => {
      c.applyOptions({
        width: el.clientWidth,
        ...(height ? {} : { height: el.clientHeight }),
      });
    });
    ro.observe(el);

    return () => {
      off();
      ro.disconnect();
      c.remove();
      chart.current = null;
      series.current = null;
      priceLines.current = [];
    };
  }, [asset, height, fill]);

  // Tone changes recolor the existing series; rebuilding the chart here
  // would drop the price lines and throw on the next update.
  useEffect(() => {
    const s = series.current;
    if (!s) return;
    s.applyOptions({
      lineColor: color,
      topColor: fill ? `${color}38` : "transparent",
      bottomColor: `${color}00`,
      priceLineColor: color,
    });
  }, [color, fill]);

  // reference lines (lock price, entry price, duel shots)
  const linesKey = lines
    .map((l) => `${l.title}:${l.price.toFixed(4)}:${l.color}`)
    .join("|");

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    for (const l of priceLines.current) {
      try {
        s.removePriceLine(l);
      } catch {
        // series was recreated under us; the old handle is already gone
      }
    }
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
    // `lines` is rebuilt every render; the key is what actually changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey]);

  return (
    <div
      ref={box}
      className="w-full"
      style={height ? { height } : { height: "100%" }}
    />
  );
}
