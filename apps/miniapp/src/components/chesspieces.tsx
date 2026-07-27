/**
 * A Staunton piece set drawn as SVG.
 *
 * Downloading a set would mean shipping someone else's artwork and a
 * pile of external bytes into a Telegram mini app; these are built from
 * plain shapes with a top-down gradient and a dark outline, which reads
 * as turned wood at 40px and stays sharp on any screen.
 *
 * Everything lives in one 45×45 box so the pieces sit at a consistent
 * scale on the board, the way a real set does.
 */

import { useId, type ReactElement } from "react";
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK } from "../lib/chess";

type Skin = {
  light: string;
  mid: string;
  dark: string;
  line: string;
  /** the carved seam between a piece's parts */
  seam: string;
};

const WHITE_SKIN: Skin = {
  light: "#ffffff",
  mid: "#efece4",
  dark: "#b6b2a6",
  line: "#2f2c26",
  seam: "#8d8a80",
};

const BLACK_SKIN: Skin = {
  light: "#71717e",
  mid: "#33333d",
  dark: "#111116",
  line: "#000000",
  seam: "#6a6a77",
};

/** The foot every piece stands on, so the set looks like one set */
const BASE = "M10.2 34.4h24.6l1.7 3v2.2H8.5v-2.2z";
const PLINTH = "M12.3 31.3h20.4v3.1H12.3z";

function Body({ d, skin, grad }: { d: string; skin: Skin; grad: string }) {
  return (
    <path
      d={d}
      fill={`url(#${grad})`}
      stroke={skin.line}
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
  );
}

const SHAPES: Record<number, (skin: Skin, g: string) => ReactElement> = {
  [PAWN]: (skin, g) => (
    <>
      <Body skin={skin} grad={g} d={BASE} />
      <Body skin={skin} grad={g} d={PLINTH} />
      <Body
        skin={skin}
        grad={g}
        d="M17.2 17.9h10.6c-.9 3 .4 4.7 2.3 6.9 2.3 2.6 3.5 4.6 3.6 6.5H11.3c.1-1.9 1.3-3.9 3.6-6.5 1.9-2.2 3.2-3.9 2.3-6.9z"
      />
      <Body
        skin={skin}
        grad={g}
        d="M16.6 15.6h11.8v2.6H16.6z"
      />
      <circle
        cx="22.5"
        cy="10.4"
        r="5.5"
        fill={`url(#${g})`}
        stroke={skin.line}
        strokeWidth="1.1"
      />
    </>
  ),

  [ROOK]: (skin, g) => (
    <>
      <Body skin={skin} grad={g} d={BASE} />
      <Body skin={skin} grad={g} d={PLINTH} />
      <Body
        skin={skin}
        grad={g}
        d="M14.4 19.9h16.2l1.2 11.4H13.2z"
      />
      <Body
        skin={skin}
        grad={g}
        d="M11.4 17h22.2v3H11.4z"
      />
      <Body
        skin={skin}
        grad={g}
        d="M11.9 8.6h4.7v3.3h4v-3.3h4.8v3.3h4v-3.3h4.7V17H11.9z"
      />
      <path
        d="M14.4 19.9h16.2M11.9 12.4h21.2"
        stroke={skin.seam}
        strokeWidth=".8"
        opacity=".55"
      />
    </>
  ),

  [BISHOP]: (skin, g) => (
    <>
      <Body skin={skin} grad={g} d={BASE} />
      <Body skin={skin} grad={g} d={PLINTH} />
      <Body
        skin={skin}
        grad={g}
        d="M15.3 27.6h14.4c.3 1.6-.7 2.6-1.9 3.7H17.2c-1.2-1.1-2.2-2.1-1.9-3.7z"
      />
      <Body
        skin={skin}
        grad={g}
        d="M16.1 24.6h12.8v3.1H16.1z"
      />
      <Body
        skin={skin}
        grad={g}
        d="M22.5 9.9c3.4 3 6 6.1 6 9.4 0 3.3-2.7 5.6-6 5.6s-6-2.3-6-5.6c0-3.3 2.6-6.4 6-9.4z"
      />
      <path
        d="M22.5 13.9v6.8M19.2 17.3h6.6"
        stroke={skin.line}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle
        cx="22.5"
        cy="6.9"
        r="2.4"
        fill={`url(#${g})`}
        stroke={skin.line}
        strokeWidth="1.1"
      />
    </>
  ),

  [QUEEN]: (skin, g) => (
    <>
      <Body skin={skin} grad={g} d={BASE} />
      <Body skin={skin} grad={g} d={PLINTH} />
      <Body
        skin={skin}
        grad={g}
        d="M11.5 27.4h22c.2 1.8-.7 2.7-1.9 3.9H13.4c-1.2-1.2-2.1-2.1-1.9-3.9z"
      />
      <Body
        skin={skin}
        grad={g}
        d="M10.6 24.2h23.8v3.2H10.6z"
      />
      <Body
        skin={skin}
        grad={g}
        d="M9.4 25c3.5-1.7 8-2.5 13.1-2.5s9.6.8 13.1 2.5l2.4-12.6-5.9 8.1-.8-13.7-5.2 12.6-3.6-14.6-3.6 14.6L13.7 7.3l-.8 13.7L7 12.9z"
      />
      {[
        [7, 12.6],
        [14.4, 8.4],
        [22.5, 6.6],
        [30.6, 8.4],
        [38, 12.6],
      ].map(([cx, cy], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={i === 2 ? 2.7 : 2.4}
          fill={`url(#${g})`}
          stroke={skin.line}
          strokeWidth="1.1"
        />
      ))}
    </>
  ),

  [KING]: (skin, g) => (
    <>
      <Body skin={skin} grad={g} d={BASE} />
      <Body skin={skin} grad={g} d={PLINTH} />
      <Body
        skin={skin}
        grad={g}
        d="M11.9 27.4h21.2c.2 1.8-.7 2.7-1.9 3.9H13.8c-1.2-1.2-2.1-2.1-1.9-3.9z"
      />
      <Body
        skin={skin}
        grad={g}
        d="M11 24.2h23v3.2H11z"
      />
      <Body
        skin={skin}
        grad={g}
        d="M22.5 11.2c-5.8 0-10.3 3.7-10.3 8.4 0 1.8.5 3.3 1.5 4.8h17.6c1-1.5 1.5-3 1.5-4.8 0-4.7-4.5-8.4-10.3-8.4z"
      />
      <path
        d="M16.4 19.4c2-1.4 4-2.1 6.1-2.1s4.1.7 6.1 2.1"
        stroke={skin.seam}
        strokeWidth=".9"
        fill="none"
        opacity=".5"
        strokeLinecap="round"
      />
      <Body
        skin={skin}
        grad={g}
        d="M20.8 2.4h3.4v3.6h3.6v3.4h-3.6v4.2h-3.4V9.4h-3.6V6h3.6z"
      />
    </>
  ),

  [KNIGHT]: (skin, g) => (
    <>
      <Body skin={skin} grad={g} d={BASE} />
      <Body skin={skin} grad={g} d={PLINTH} />
      <Body
        skin={skin}
        grad={g}
        d="M14.1 31.3c0-5.6 1-9.4 3.1-12.3 1.2-1.7 2.6-3 4.4-4.3l-4.7 1.3-3.1 3.9-3-2.1 1.4-4.7 4.5-4.1 4.8-2.2 1-4.6 3.6 3.2c4.4.7 7.4 3.1 9 7.2 1.2 3.3 1.7 7.5 1.7 12.5v6.2z"
      />
      {/* the eye and the cut of the mane are what make it read as a horse */}
      <ellipse
        cx="19.6"
        cy="15.4"
        rx="1.5"
        ry="1.2"
        fill={skin.line}
        transform="rotate(-28 19.6 15.4)"
      />
      <path
        d="M25.6 9.6c2.9 1.1 4.7 3.3 5.6 6.6"
        stroke={skin.seam}
        strokeWidth="1"
        fill="none"
        opacity=".6"
        strokeLinecap="round"
      />
      <path
        d="M15.4 17.6l2.6-1.4"
        stroke={skin.line}
        strokeWidth=".9"
        strokeLinecap="round"
        opacity=".7"
      />
    </>
  ),
};

export function ChessPiece({
  type,
  white,
  size,
}: {
  type: number;
  white: boolean;
  size?: number | string;
}) {
  const skin = white ? WHITE_SKIN : BLACK_SKIN;
  // two <defs> sharing an id on one page make the second one lose, so
  // each instance gets its own — stable across renders, not a counter
  const g = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 45 45"
      width={size ?? "100%"}
      height={size ?? "100%"}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={g} x1="0.24" y1="0" x2="0.72" y2="1">
          <stop offset="0%" stopColor={skin.light} />
          <stop offset="46%" stopColor={skin.mid} />
          <stop offset="100%" stopColor={skin.dark} />
        </linearGradient>
      </defs>
      <ellipse
        cx="22.5"
        cy="39.4"
        rx="13.6"
        ry="2.4"
        fill="rgba(0,0,0,.3)"
      />
      <g
        style={{
          filter: "drop-shadow(0 1.5px 1.5px rgba(0,0,0,.45))",
        }}
      >
        {SHAPES[type]?.(skin, g)}
      </g>
    </svg>
  );
}

export const PIECE_ORDER = [KING, QUEEN, ROOK, BISHOP, KNIGHT, PAWN];
