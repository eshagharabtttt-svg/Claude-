/**
 * اسنپ‌شات داده‌ی واقعی پلی‌مارکت برای حالت آفلاین / نمونه‌ی اولیه.
 *
 *   node scripts/snapshot-polymarket.mjs
 *
 * خروجی: src/data/polymarket-snapshot.json
 * در محیط واقعی همین داده به‌صورت زنده از Gamma API خوانده می‌شود و این
 * فایل فقط نقش fallback را دارد (وقتی شبکه در دسترس نیست).
 */
import { writeFileSync, mkdirSync } from "node:fs";

const GAMMA = "https://gamma-api.polymarket.com";

const CATEGORIES = [
  { key: "trending", tag: null, limit: 8 },
  { key: "sports", tag: "sports", limit: 8 },
  { key: "esports", tag: "esports", limit: 6 },
  { key: "crypto", tag: "crypto", limit: 8 },
  { key: "politics", tag: "politics", limit: 6 },
];

const num = (v) => (v == null ? 0 : Number(v) || 0);

function parseList(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function normalizeMarket(m) {
  const outcomes = parseList(m.outcomes);
  const prices = parseList(m.outcomePrices).map(num);
  return {
    id: String(m.id),
    question: m.question ?? "",
    label: m.groupItemTitle || null,
    outcomes: outcomes.map((name, i) => ({
      name,
      price: prices[i] ?? 0,
    })),
    volume: num(m.volumeNum ?? m.volume),
    volume24h: num(m.volume24hr),
    closed: !!m.closed,
    endDate: m.endDate ?? null,
    resolutionSource: m.resolutionSource || null,
  };
}

function normalizeEvent(e) {
  const markets = (e.markets ?? [])
    .filter((m) => !m.closed && m.outcomes)
    .map(normalizeMarket)
    .filter((m) => m.outcomes.length >= 2)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);

  return {
    id: String(e.id),
    slug: e.slug ?? null,
    title: e.title ?? "",
    description: (e.description ?? "").slice(0, 900) || null,
    live: !!e.live,
    endDate: e.endDate ?? null,
    volume24h: num(e.volume24hr),
    volume: num(e.volume),
    liquidity: num(e.liquidity ?? e.liquidityClob),
    openInterest: num(e.openInterest),
    resolutionSource: e.resolutionSource || null,
    markets,
  };
}

async function fetchCategory({ key, tag, limit }) {
  const url = new URL(`${GAMMA}/events`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("closed", "false");
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");
  if (tag) url.searchParams.set("tag_slug", tag);

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
  const raw = await res.json();
  const events = (Array.isArray(raw) ? raw : [])
    .map(normalizeEvent)
    .filter((e) => e.markets.length > 0);
  return [key, events];
}

const entries = await Promise.all(CATEGORIES.map(fetchCategory));

const snapshot = {
  source: "polymarket-gamma",
  capturedAt: new Date().toISOString(),
  categories: Object.fromEntries(entries),
};

mkdirSync("src/data", { recursive: true });
writeFileSync(
  "src/data/polymarket-snapshot.json",
  JSON.stringify(snapshot, null, 0)
);

for (const [k, v] of entries) {
  console.log(`${k.padEnd(9)} ${String(v.length).padStart(2)} events`);
}
console.log("→ src/data/polymarket-snapshot.json");
