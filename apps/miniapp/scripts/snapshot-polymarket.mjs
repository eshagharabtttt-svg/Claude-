/**
 * اسنپ‌شات داده‌ی واقعی پلی‌مارکت — رویدادها، تاریخچه‌ی احتمال و آیکون‌ها.
 *
 *   node scripts/snapshot-polymarket.mjs
 *
 * خروجی: src/data/polymarket-snapshot.json
 *
 * آیکون‌ها دانلود، کوچک و به data URI تبدیل می‌شوند تا اپ به CDN بیرونی
 * وابسته نباشد. در محیط واقعی همین داده زنده خوانده می‌شود و این فایل
 * فقط نقش fallback دارد.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";

const CATEGORIES = [
  { key: "trending", tag: null, limit: 8 },
  { key: "sports", tag: "sports", limit: 8 },
  { key: "esports", tag: "esports", limit: 6 },
  { key: "crypto", tag: "crypto", limit: 8 },
  { key: "politics", tag: "politics", limit: 6 },
];

/** چند بازارِ هر رویداد تاریخچه بگیرند */
const HISTORY_PER_EVENT = 4;
/** حداکثر نقطه در هر سری بعد از نمونه‌برداری */
const HISTORY_POINTS = 70;

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

/* ---------- همزمانی محدود ---------- */

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          out[idx] = await fn(items[idx], idx);
        } catch {
          out[idx] = null;
        }
      }
    })
  );
  return out;
}

/* ---------- آیکون ---------- */

const iconCache = new Map();

async function iconDataUri(url) {
  if (!url || !/^https?:\/\//.test(url)) return null;
  if (iconCache.has(url)) return iconCache.get(url);

  let result = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      // تغییر اندازه و فشرده‌سازی با Pillow — خروجی WEBP کوچک
      const b64 = execFileSync(
        "python3",
        [
          "-c",
          `
import sys, io, base64
from PIL import Image
raw = sys.stdin.buffer.read()
im = Image.open(io.BytesIO(raw)).convert("RGBA")
im.thumbnail((72, 72), Image.LANCZOS)
bg = Image.new("RGBA", im.size, (0, 0, 0, 0))
bg.alpha_composite(im)
out = io.BytesIO()
bg.convert("RGB").save(out, "WEBP", quality=72, method=6)
sys.stdout.write(base64.b64encode(out.getvalue()).decode())
`,
        ],
        { input: buf, maxBuffer: 32 * 1024 * 1024 }
      ).toString();
      result = `data:image/webp;base64,${b64}`;
    }
  } catch {
    result = null;
  }
  iconCache.set(url, result);
  return result;
}

/* ---------- تاریخچه‌ی احتمال ---------- */

const histCache = new Map();

async function fetchHistory(tokenId) {
  if (!tokenId) return null;
  if (histCache.has(tokenId)) return histCache.get(tokenId);

  let pts = null;
  try {
    const url = `${CLOB}/prices-history?market=${tokenId}&interval=1w&fidelity=60`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const raw = await res.json();
      const all = Array.isArray(raw?.history) ? raw.history : [];
      if (all.length > 1) {
        const step = Math.max(1, Math.ceil(all.length / HISTORY_POINTS));
        pts = all
          .filter((_, i) => i % step === 0 || i === all.length - 1)
          .map((h) => [Math.round(num(h.t)), Number(num(h.p).toFixed(4))]);
      }
    }
  } catch {
    pts = null;
  }
  histCache.set(tokenId, pts);
  return pts;
}

/* ---------- نرمال‌سازی ---------- */

function normalizeMarket(m) {
  const outcomes = parseList(m.outcomes);
  const prices = parseList(m.outcomePrices).map(num);
  return {
    id: String(m.id),
    question: m.question ?? "",
    label: m.groupItemTitle || null,
    outcomes: outcomes.map((name, i) => ({ name, price: prices[i] ?? 0 })),
    tokenIds: parseList(m.clobTokenIds).map(String),
    volume: num(m.volumeNum ?? m.volume),
    volume24h: num(m.volume24hr),
    closed: !!m.closed,
    endDate: m.endDate ?? null,
    resolutionSource: m.resolutionSource || null,
    history: null,
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
    icon: null,
    iconUrl: e.icon || e.image || null,
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

const edge = (m) => Math.abs((m.outcomes[0]?.price ?? 0) - 0.5);

/* ---------- اجرا ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** تلاش مجدد با عقب‌نشینی نمایی — Gamma گاهی ۵۰۳ می‌دهد */
async function retry(fn, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (i < tries - 1) await sleep(1500 * 2 ** i);
    }
  }
  throw last;
}

async function fetchCategory({ key, tag, limit }) {
  const url = new URL(`${GAMMA}/events`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("closed", "false");
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");
  if (tag) url.searchParams.set("tag_slug", tag);

  const raw = await retry(async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
    return res.json();
  });

  const events = (Array.isArray(raw) ? raw : [])
    .map(normalizeEvent)
    .filter((e) => e.markets.length > 0);
  return [key, events];
}

// ترتیبی، نه موازی — تا ریت‌لیمیت نخوریم
const fetched = [];
for (const c of CATEGORIES) {
  fetched.push(await fetchCategory(c));
  await sleep(400);
}

// یکتاسازی: رویدادها یک‌بار ذخیره، دسته‌ها فقط شناسه نگه می‌دارند
const events = new Map();
const categories = {};
for (const [key, list] of fetched) {
  categories[key] = list.map((e) => e.id);
  for (const e of list) if (!events.has(e.id)) events.set(e.id, e);
}

const all = [...events.values()];
console.log(`${all.length} رویداد یکتا`);

// آیکون‌ها
const icons = await pool(all, 6, (e) => iconDataUri(e.iconUrl));
all.forEach((e, i) => {
  e.icon = icons[i];
  delete e.iconUrl;
});
console.log(`${icons.filter(Boolean).length} آیکون`);

// تاریخچه برای رقابتی‌ترین بازارهای هر رویداد
const jobs = [];
for (const e of all) {
  [...e.markets]
    .sort((a, b) => edge(a) - edge(b))
    .slice(0, HISTORY_PER_EVENT)
    .forEach((m) => jobs.push(m));
}
const hist = await pool(jobs, 8, (m) => fetchHistory(m.tokenIds[0]));
jobs.forEach((m, i) => {
  m.history = hist[i];
});
console.log(`${hist.filter(Boolean).length}/${jobs.length} سری تاریخچه`);

mkdirSync("src/data", { recursive: true });
const snapshot = {
  source: "polymarket-gamma+clob",
  capturedAt: new Date().toISOString(),
  events: Object.fromEntries(events),
  categories,
};
const json = JSON.stringify(snapshot);
writeFileSync("src/data/polymarket-snapshot.json", json);
console.log(`→ src/data/polymarket-snapshot.json (${(json.length / 1024) | 0} KB)`);
