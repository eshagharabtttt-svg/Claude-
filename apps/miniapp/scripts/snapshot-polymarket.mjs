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
  { key: "sports", tag: "sports", limit: 10 },
  { key: "esports", tag: "esports", limit: 8 },
  { key: "crypto", tag: "crypto", limit: 8 },
  { key: "politics", tag: "politics", limit: 8 },
  { key: "geopolitics", tag: "geopolitics", limit: 8 },
  { key: "finance", tag: "finance", limit: 8 },
  { key: "tech", tag: "tech", limit: 8 },
  { key: "culture", tag: "pop-culture", limit: 8 },
];

/**
 * پلی‌مارکت یک رویداد را زیر چند تگ می‌گذارد (مثلاً مسابقه‌ی LoL هم
 * «ورزش» است هم «ای‌اسپورتس»). هر رویداد فقط به مشخص‌ترین دسته‌ای که
 * ادعایش را دارد تعلق می‌گیرد، وگرنه بخش‌ها تکراری می‌شوند.
 */
const CLAIM_ORDER = [
  "esports",
  "crypto",
  "geopolitics",
  "tech",
  "culture",
  "finance",
  "politics",
  "sports",
];

/** چند بازارِ هر رویداد تاریخچه بگیرند */
const HISTORY_PER_EVENT = 3;
/** حداکثر نقطه در هر سری بعد از نمونه‌برداری */
const HISTORY_POINTS = 56;

const num = (v) => (v == null ? 0 : Number(v) || 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const url = `${CLOB}/prices-history?market=${tokenId}&interval=1w&fidelity=60`;
  for (let attempt = 0; attempt < 4 && !pts; attempt++) {
    if (attempt) await sleep(800 * 2 ** attempt);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const raw = await res.json();
      const all = Array.isArray(raw?.history) ? raw.history : [];
      if (all.length > 1) {
        const step = Math.max(1, Math.ceil(all.length / HISTORY_POINTS));
        pts = all
          .filter((_, i) => i % step === 0 || i === all.length - 1)
          .map((h) => [Math.round(num(h.t)), Number(num(h.p).toFixed(4))]);
      } else {
        break; // پاسخ درست بود ولی داده ندارد — تلاش مجدد بی‌فایده است
      }
    } catch {
      /* تلاش بعدی */
    }
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

/** تعداد کل بازارهای یک دسته */
async function fetchCount(tag) {
  try {
    const url = new URL(`${GAMMA}/events/pagination`);
    url.searchParams.set("limit", "1");
    url.searchParams.set("closed", "false");
    if (tag) url.searchParams.set("tag_slug", tag);
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return 0;
    const d = await res.json();
    return Number(d?.pagination?.totalResults) || 0;
  } catch {
    return 0;
  }
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
    .filter((e) => e.markets.length > 0)
    .map((e) => ({ ...e, category: key }));
  const total = await fetchCount(tag);
  return [key, events, total];
}

// ترتیبی، نه موازی — تا ریت‌لیمیت نخوریم
const fetched = [];
for (const c of CATEGORIES) {
  fetched.push(await fetchCategory(c));
  await sleep(400);
}

// یکتاسازی: رویدادها یک‌بار ذخیره، دسته‌ها فقط شناسه نگه می‌دارند
const events = new Map();
const byKey = new Map(fetched.map(([key, list]) => [key, list]));
const counts = Object.fromEntries(fetched.map(([key, , total]) => [key, total]));

// هر رویداد فقط یک‌بار، در مشخص‌ترین دسته
const claimed = new Set();
const categories = {};
for (const key of CLAIM_ORDER) {
  const mine = [];
  for (const e of byKey.get(key) ?? []) {
    if (claimed.has(e.id)) continue;
    claimed.add(e.id);
    e.category = key;
    events.set(e.id, e);
    mine.push(e.id);
    if (mine.length >= 6) break;
  }
  categories[key] = mine;
}
for (const [key, ids] of Object.entries(categories)) {
  console.log(`  ${key.padEnd(12)} ${ids.length}`);
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
const hist = await pool(jobs, 4, (m) => fetchHistory(m.tokenIds[0]));
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
  counts,
};
const json = JSON.stringify(snapshot);
writeFileSync("src/data/polymarket-snapshot.json", json);
console.log(`→ src/data/polymarket-snapshot.json (${(json.length / 1024) | 0} KB)`);
