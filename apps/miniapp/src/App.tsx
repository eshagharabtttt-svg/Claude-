import { useState } from "react";
import { PlayerProvider } from "./lib/store";
import { ChromeProvider, useChrome } from "./lib/chrome";
import { Home } from "./screens/Home";
import { Play } from "./screens/Play";
import { Duel } from "./screens/Duel";
import { Markets } from "./screens/Markets";
import { Tasks } from "./screens/Tasks";

export type Tab = "home" | "play" | "duel" | "markets" | "tasks";

const NAV: { id: Tab; icon: string; label: string }[] = [
  { id: "home", icon: "⌂", label: "Home" },
  { id: "play", icon: "⚡", label: "Play" },
  { id: "duel", icon: "⚔", label: "Duel" },
  { id: "markets", icon: "◎", label: "Markets" },
  { id: "tasks", icon: "✓", label: "Tasks" },
];

export default function App() {
  return (
    <PlayerProvider>
      <ChromeProvider>
        <Shell />
      </ChromeProvider>
    </PlayerProvider>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("home");
  // Tapping the active tab should return it to its root screen, the way
  // every native tab bar behaves. Bumping the key remounts the section.
  const [resetSeq, setResetSeq] = useState(0);

  const select = (next: Tab) => {
    if (next === tab) setResetSeq((n) => n + 1);
    setTab(next);
  };

  const { navHidden } = useChrome();

  return (
    <div className="mx-auto h-full max-w-[480px] relative bg-bg">
        {tab === "home" && <Home go={select} />}
        {tab === "play" && <Play key={resetSeq} />}
        {tab === "duel" && <Duel key={resetSeq} />}
        {tab === "markets" && <Markets key={resetSeq} />}
        {tab === "tasks" && <Tasks />}

      {!navHidden && (
        <nav className="absolute bottom-0 inset-x-0 h-[68px] bg-s1/95 backdrop-blur border-t border-line flex items-center px-2">
          {NAV.map((n) => {
            const on = tab === n.id;
            return (
              <button
                key={n.id}
                onClick={() => select(n.id)}
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
      )}
    </div>
  );
}
