import { useState } from "react";

/** Stable tint derived from the name, so an event keeps its color */
const TINTS = [
  "#c6f73c",
  "#16c784",
  "#3b82f6",
  "#f5a524",
  "#f0616d",
  "#a855f7",
];

function tintOf(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

/**
 * Event artwork. When the image is missing or fails to load it falls back
 * to a tinted initial, so a broken or empty box is never shown.
 */
export function EventIcon({
  src,
  name,
  size = 44,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const tint = tintOf(name);
  const radius = Math.round(size * 0.28);

  if (!src || failed) {
    const letter = (name.trim()[0] ?? "?").toUpperCase();
    return (
      <div
        className="shrink-0 flex items-center justify-center font-extrabold"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: `${tint}22`,
          border: `1px solid ${tint}44`,
          color: tint,
          fontSize: Math.round(size * 0.4),
        }}
      >
        {letter}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 object-cover bg-s2"
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}
