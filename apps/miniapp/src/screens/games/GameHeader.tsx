import type { ReactNode } from "react";

export function GameHeader({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-t2 active:text-t1"
      >
        <span className="text-[18px] leading-none">←</span>
        <span className="text-[17px] font-extrabold text-t1">{title}</span>
      </button>
      {children}
    </header>
  );
}
