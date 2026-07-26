import { RED, rankLabel, type Card, type Suit } from "../lib/hokm";

/**
 * Playing-card faces drawn in CSS. At phone size a full pip layout is
 * unreadable, so a card reads the way it does in the hand of a real
 * player: corner index first, large centre glyph second.
 */

const INK = { red: "#c8102e", black: "#141419" };

export function CardFace({
  card,
  w = 44,
  selected,
  dim,
  glow,
}: {
  card: Card;
  w?: number;
  selected?: boolean;
  dim?: boolean;
  glow?: boolean;
}) {
  const h = Math.round(w * 1.42);
  const color = RED.includes(card.s) ? INK.red : INK.black;
  const idx = Math.max(9, Math.round(w * 0.3));
  const pip = Math.max(16, Math.round(w * 0.52));
  const court = card.r > 10;

  return (
    <div
      className="relative rounded-[6px] select-none"
      style={{
        width: w,
        height: h,
        background: "linear-gradient(160deg, #ffffff, #ececea)",
        border: `1px solid ${selected ? "#c6f73c" : "#c9c9c4"}`,
        boxShadow: glow
          ? "0 0 0 2px #c6f73c, 0 6px 16px rgba(0,0,0,.5)"
          : "0 2px 6px rgba(0,0,0,.45)",
        filter: dim ? "grayscale(.85) brightness(.7)" : undefined,
        transition: "box-shadow .15s, border-color .15s",
      }}
    >
      <div
        className="absolute leading-none font-extrabold"
        style={{ color, top: 3, left: 4, fontSize: idx }}
      >
        <div>{rankLabel(card.r)}</div>
        <div style={{ fontSize: idx * 0.85, marginTop: -1 }}>{card.s}</div>
      </div>

      <div
        className="absolute inset-0 flex items-center justify-center font-extrabold"
        style={{ color, fontSize: court ? pip * 0.92 : pip, opacity: 0.95 }}
      >
        {court ? rankLabel(card.r) : card.s}
      </div>

      <div
        className="absolute leading-none font-extrabold rotate-180"
        style={{ color, bottom: 3, right: 4, fontSize: idx }}
      >
        <div>{rankLabel(card.r)}</div>
        <div style={{ fontSize: idx * 0.85, marginTop: -1 }}>{card.s}</div>
      </div>
    </div>
  );
}

export function CardBack({ w = 30 }: { w?: number }) {
  const h = Math.round(w * 1.42);
  return (
    <div
      className="rounded-[6px]"
      style={{
        width: w,
        height: h,
        background:
          "repeating-linear-gradient(45deg, #1e3a8a 0 4px, #1d4ed8 4px 8px)",
        border: "1px solid #0f2258",
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,.14), 0 2px 5px rgba(0,0,0,.4)",
      }}
    />
  );
}

/** A fan of face-down cards, used for the three seats you cannot see */
export function CardFan({
  count,
  vertical,
  w = 26,
}: {
  count: number;
  vertical?: boolean;
  w?: number;
}) {
  const shown = Math.min(count, 13);
  const spread = vertical ? 9 : 11;
  const arc = 3;
  const mid = (shown - 1) / 2;

  return (
    <div
      className="relative"
      style={{
        width: vertical ? Math.round(w * 1.42) : (shown - 1) * spread + w,
        height: vertical ? (shown - 1) * spread + Math.round(w * 1.42) : Math.round(w * 1.42) + 8,
      }}
    >
      {Array.from({ length: shown }).map((_, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: vertical ? 0 : i * spread,
            top: vertical ? i * spread : Math.abs(i - mid) * 0.9,
            transform: vertical
              ? `rotate(${(i - mid) * arc + 90}deg)`
              : `rotate(${(i - mid) * arc}deg)`,
            transformOrigin: "center",
          }}
        >
          <CardBack w={w} />
        </div>
      ))}
    </div>
  );
}

export const suitColor = (s: Suit) => (RED.includes(s) ? INK.red : INK.black);
