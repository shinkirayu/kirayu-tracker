import { Suspense, lazy, useState } from "react";
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { pb, GAMES, getEnabledGames, type GameId } from "./lib/pocketbase";
import { useSession } from "./hooks/useAuth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeToggle } from "./components/ThemeToggle";
import { SkeletonGrid } from "./components/Skeletons";
import { ToastProvider } from "./components/Toast";
import { Tooltip } from "./components/Tooltip";
import { GetScriptButton as AeGetScriptButton } from "./games/ae/components/GetScriptButton";
import { GetScriptButton as Mm2GetScriptButton } from "./games/mm2/components/GetScriptButton";
import { GetScriptButton as GtdGetScriptButton } from "./games/gtd/components/GetScriptButton";

const GAME_ICON_SRC: Record<GameId, string> = {
  ae: "/game-icons/ae.png",
  mm2: "/game-icons/mm2.png",
  gtd: "/game-icons/gtd.png",
};

/** Reads the active game (if any) off the current URL, e.g. /mm2/account/123 -> "mm2". */
function useActiveGame(): GameId | null {
  const { pathname } = useLocation();
  const match = /^\/(ae|mm2|gtd)(\/|$)/.exec(pathname);
  return (match?.[1] as GameId | undefined) ?? null;
}

/** Sidebar visibility, persisted across reloads. */
function useSidebarOpen() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("kirayu-sidebar") !== "closed";
    } catch {
      return true;
    }
  });

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("kirayu-sidebar", next ? "open" : "closed");
      } catch {
        /* private mode */
      }
      return next;
    });
  }

  return [open, toggle] as const;
}

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className={className}>
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  );
}

const LoginPage = lazy(() => import("./pages/LoginPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AeHome = lazy(() => import("./games/ae/AeHome"));
const Mm2Home = lazy(() => import("./games/mm2/Mm2Home"));
const GtdHome = lazy(() => import("./games/gtd/GtdHome"));

function NavItem({ to, end, children }: { to: string; end?: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-300 ${
          isActive
            ? "bg-[var(--shell-accent)] text-white shadow-sm"
            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

const GAME_TABS: Partial<Record<GameId, { to: string; label: string }[]>> = {
  ae: [
    { to: "/ae", label: "Accounts" },
    { to: "/ae/units", label: "Units" },
    { to: "/ae/eldorado", label: "Eldorado" },
    { to: "/ae/zeusx", label: "ZeusX" },
    { to: "/ae/autoswap", label: "Autoswap" },
  ],
  mm2: [
    { to: "/mm2", label: "Accounts" },
    { to: "/mm2/items", label: "Items" },
  ],
  gtd: [
    { to: "/gtd", label: "Accounts" },
    { to: "/gtd/inventory", label: "Inventory" },
    { to: "/gtd/automation", label: "Automation" },
  ],
};

function GameTabs({ id }: { id: GameId }) {
  const tabs = GAME_TABS[id];
  if (!tabs) return null;
  return (
    <nav className="flex items-center gap-1">
      {tabs.map((t) => (
        <NavItem key={t.to} to={t.to} end={t.to === `/${id}`}>
          {t.label}
        </NavItem>
      ))}
    </nav>
  );
}

/** Square logo-style icon button for one game — its own Roblox game icon, with a hover tooltip naming it. */
function GameIcon({ id }: { id: GameId }) {
  const game = GAMES[id];
  return (
    <Tooltip label={game.label}>
      <NavLink to={`/${id}`}>
        {({ isActive }) => (
          <span
            className={`flex size-11 items-center justify-center overflow-hidden rounded-xl shadow-sm transition-all ${
              isActive
                ? "ring-2 ring-[var(--shell-accent)] ring-offset-2 ring-offset-zinc-50 dark:ring-offset-[#0a0a0c]"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            <img src={GAME_ICON_SRC[id]} alt={game.label} className="size-full object-cover" />
          </span>
        )}
      </NavLink>
    </Tooltip>
  );
}

function Sidebar() {
  const enabled = getEnabledGames();

  return (
    <aside className="sticky top-0 flex h-dvh w-[72px] shrink-0 flex-col items-center gap-3 border-r border-zinc-200/80 bg-white/80 py-4 backdrop-blur dark:border-white/10 dark:bg-[#0a0a0c]/85">
      <Link
        to="/"
        className="flex size-10 items-center justify-center rounded-xl bg-[var(--shell-accent)] text-sm font-bold text-white shadow-sm transition-colors duration-300"
      >
        K
      </Link>
      {enabled.length > 0 && <div className="h-px w-8 bg-[var(--shell-accent-soft)] transition-colors duration-300" />}
      <nav className="flex flex-col items-center gap-2.5">
        {enabled.map((id) => (
          <GameIcon key={id} id={id} />
        ))}
      </nav>
    </aside>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const activeGame = useActiveGame();
  const [sidebarOpen, toggleSidebar] = useSidebarOpen();

  return (
    <div className="flex min-h-dvh" data-shell-theme={activeGame ?? "default"}>
      {sidebarOpen && <Sidebar />}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b-2 border-[var(--shell-accent)]/40 bg-white/80 backdrop-blur transition-colors duration-300 dark:bg-[#0a0a0c]/85">
          <div className="flex items-center gap-1.5 px-4 py-3">
            <button
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
            >
              <HamburgerIcon className="size-4" />
            </button>
            {activeGame && (
              <>
                <span className="text-sm font-semibold tracking-tight text-[var(--shell-accent)] transition-colors duration-300">
                  {GAMES[activeGame].label}
                </span>
                <GameTabs id={activeGame} />
              </>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {activeGame === "ae" && <AeGetScriptButton />}
              {activeGame === "mm2" && <Mm2GetScriptButton />}
              {activeGame === "gtd" && <GtdGetScriptButton />}
              <ThemeToggle />
              <NavItem to="/settings">Settings</NavItem>
              <button
                onClick={() => pb.authStore.clear()}
                className="rounded-full px-3.5 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="px-4 py-6">{children}</main>
      </div>
    </div>
  );
}

function Gate() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <SkeletonGrid count={6} />
      </div>
    );
  }
  if (!session) {
    return (
      <Suspense fallback={null}>
        <LoginPage />
      </Suspense>
    );
  }

  const enabled = getEnabledGames();
  const firstGame = enabled[0];

  return (
    <Shell>
      <Suspense fallback={<SkeletonGrid count={6} />}>
        <Routes>
          <Route path="/" element={<Navigate to={firstGame ? `/${firstGame}` : "/settings"} replace />} />
          <Route path="/ae/*" element={<AeHome />} />
          <Route path="/mm2/*" element={<Mm2Home />} />
          <Route path="/gtd/*" element={<GtdHome />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <Gate />
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
