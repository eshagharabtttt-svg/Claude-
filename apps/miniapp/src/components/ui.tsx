import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[18px] border border-line bg-s1 ${className}`}
    >
      {children}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "surface" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: BtnProps) {
  const v =
    variant === "primary"
      ? "bg-brand text-bg active:bg-brandlo disabled:bg-s3 disabled:text-t3"
      : variant === "surface"
        ? "bg-s2 text-t1 border border-line active:bg-s3"
        : "text-t2 active:text-t1";
  const s =
    size === "lg"
      ? "h-14 text-[17px] rounded-2xl"
      : size === "sm"
        ? "h-9 px-3 text-[13px] rounded-xl"
        : "h-12 px-4 text-[15px] rounded-[14px]";
  return (
    <button
      {...rest}
      className={`font-bold transition-colors disabled:cursor-not-allowed ${v} ${s} ${className}`}
    />
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 h-9 text-[13px] font-semibold transition-colors ${
        active ? "bg-t1 text-bg" : "bg-s2 text-t2 border border-line"
      }`}
    >
      {children}
    </button>
  );
}

export function BalancePill({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-brand/12 border border-brand/30 px-3 h-9">
      <span className="text-brand text-sm">◈</span>
      <span className="mono text-brand text-sm font-bold">
        {Math.round(value).toLocaleString("en-US")}
      </span>
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "up" | "down" | "brand";
}) {
  const c =
    tone === "up"
      ? "text-up"
      : tone === "down"
        ? "text-down"
        : tone === "brand"
          ? "text-brand"
          : "text-t1";
  return (
    <div className="flex-1">
      <div className="text-[11px] text-t3 mb-1">{label}</div>
      <div className={`mono text-[15px] font-bold ${c}`}>{value}</div>
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3 mt-6 first:mt-0">
      <h2 className="text-[19px] font-extrabold">{children}</h2>
      {action}
    </div>
  );
}

export function LiveBadge() {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-live/15 px-2.5 h-6">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
      <span className="text-live text-[11px] font-bold tracking-wide">LIVE</span>
    </div>
  );
}

export function ProgressRing({
  value,
  max,
  size = 76,
}: {
  value: number;
  max: number;
  size?: number;
}) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#26262a"
        strokeWidth="6"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#c6f73c"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        style={{ transition: "stroke-dashoffset .4s ease" }}
      />
    </svg>
  );
}
