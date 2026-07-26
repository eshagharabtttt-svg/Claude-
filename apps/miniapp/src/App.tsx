import { useState } from "react";
import { PlayerProvider } from "./lib/store";
import { Home } from "./screens/Home";
import { QuickPlay } from "./screens/QuickPlay";
import { Duel } from "./screens/Duel";
import { Markets } from "./screens/Markets";
import { Profile } from "./screens/Profile";

export type Tab = "home" | "play" | "duel" | "markets" | "profile";

const NAV: { id: Tab; icon: string; label: string }[] = [
  { id: "home", icon: "⌂", label: "خانه" },
  { id: "play", icon: "⚡", label: "بازی" },
  { id: "duel", icon: "⚔", label: "دوئل" },
  { id: "markets", icon: "◎", label: "بازار" },
  { id: "profile", icon: "◉", label: "پروفایل" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <PlayerProvider>
      <div dir="rtl" className="mx-auto h-full max-w-[480px] relative bg-bg">
        {tab === "home" && <Home go={setTab} />}
        {tab === "play" && <QuickPlay />}
        {tab === "duel" && <Duel />}
        {tab === "markets" && <Markets />}
        {tab === "profile" && <Profile />}

        <nav className="absolute bottom-0 inset-x-0 h-[68px] bg-s1/95 backdrop-blur border-t border-line flex items-center px-2">
          {NAV.map((n) => {
            const on = tab === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className="flex-1 flex flex-col items-center gap-1 py-2"
              >
                <span
                  className={`text-[19px] leading-none ${
                    on ? "text-brand" : "text-t3"
                  }`}
                >
                  {n.icon}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    on ? "text-brand" : "text-t3"
                  }`}
                >
                  {n.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </PlayerProvider>
  );
}
