import { Suspense, lazy, useState } from "react";
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { pb, GAMES, type GameId } from "./lib/pocketbase";
import { useSession } from "./hooks/useAuth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SkeletonGrid } from "./components/Skeletons";
import { ToastProvider } from "./components/Toast";
import { Tooltip } from "./components/Tooltip";
import { GetScriptButton as AeGetScriptButton } from "./games/ae/components/GetScriptButton";
import { GetScriptButton as Mm2GetScriptButton } from "./games/mm2/components/GetScriptButton";
import { GetScriptButton as GtdGetScriptButton } from "./games/gtd/components/GetScriptButton";
import { StatChip } from "./games/gtd/components/StatChip";
import { useGtdDashboardStats } from "./games/gtd/hooks/useGtdDashboardStats";
import { formatNumber, formatSigned } from "./games/gtd/lib/format";

const GTD_SEEDS_ICON = "https://static.wikia.nocookie.net/gtd/images/4/4b/Seeds.png/revision/latest?cb=20250807140625";

/** GTD-only "Accounts / Online / Seeds" chips shown in the top nav, right side. */
function GtdHeaderStats() {
  const stats = useGtdDashboardStats();
  return (
    <div className="header-stats">
      <StatChip icon="👥" iconClass="blue" value={formatNumber(stats.total)} label="Accounts" />
      <StatChip icon="🟢" iconClass="green" value={formatNumber(stats.online)} label="Online Now" />
      <StatChip icon={<img src={GTD_SEEDS_ICON} alt="" />} iconClass="yellow" value={formatNumber(stats.totalSeeds)} label="Total Seeds" />
      <StatChip
        icon={<img src={GTD_SEEDS_ICON} alt="" />}
        iconClass="yellow"
        value={formatSigned(stats.totalSeedsToday)}
        label="Seeds Today"
        valueClass={stats.totalSeedsToday > 0 ? "pos" : stats.totalSeedsToday < 0 ? "neg" : ""}
      />
    </div>
  );
}

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
const HomePage = lazy(() => import("./pages/HomePage"));
const AeHome = lazy(() => import("./games/ae/AeHome"));
const Mm2Home = lazy(() => import("./games/mm2/Mm2Home"));
const GtdHome = lazy(() => import("./games/gtd/GtdHome"));

/** GTD pill colors — same red/blue/violet/yellow system as Turn Off All/Rejoin
 * All, one distinct color per tab instead of a generic active/inactive
 * green-vs-grey scheme. Ignored for AE/MM2 tabs (no .pill CSS outside .gtd-theme).
 * Tabs stay grey until they're the current page - color only shows once clicked. */
type NavColor = "green" | "blue" | "violet" | "yellow";

function NavItem({
  to,
  end,
  children,
  color,
}: {
  to: string;
  end?: boolean;
  children: React.ReactNode;
  color?: NavColor;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        color
          ? `nav-tab pill ${isActive ? color : "grey"} rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-300`
          : `nav-tab rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-300 ${
              isActive ? "bg-[var(--shell-accent)] text-white shadow-sm" : "shell-muted"
            }`
      }
    >
      {children}
    </NavLink>
  );
}

const GAME_TABS: Partial<Record<GameId, { to: string; label: string; color?: NavColor }[]>> = {
  ae: [
    { to: "/ae", label: "Accounts" },
    { to: "/ae/units", label: "Units" },
    { to: "/ae/eldorado", label: "Eldorado" },
    { to: "/ae/zeusx", label: "ZeusX" },
    { to: "/ae/autoswap", label: "Autoswap" },
    { to: "/ae/processed", label: "Processed" },
  ],
  mm2: [
    { to: "/mm2", label: "Accounts" },
    { to: "/mm2/items", label: "Items" },
  ],
  gtd: [
    { to: "/gtd", label: "Accounts", color: "green" },
    { to: "/gtd/inventory", label: "Inventory", color: "blue" },
    { to: "/gtd/automation", label: "Automation", color: "violet" },
  ],
};

function GameTabs({ id }: { id: GameId }) {
  const tabs = GAME_TABS[id];
  if (!tabs) return null;
  return (
    <nav className="flex items-center gap-1">
      {tabs.map((t) => (
        <NavItem key={t.to} to={t.to} end={t.to === `/${id}`} color={t.color}>
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

function Sidebar({ open }: { open: boolean }) {
  const enabled = Object.keys(GAMES) as GameId[];

  return (
    <aside
      className={`shell-surface shell-chrome-font sticky top-0 flex h-dvh shrink-0 flex-col items-center gap-3 overflow-hidden border-r py-4 transition-[width,opacity,transform] duration-300 ease-in-out ${
        open ? "w-[72px] translate-x-0 opacity-100" : "w-0 -translate-x-2 opacity-0"
      }`}
      style={{ borderRightColor: open ? "var(--panel-border, rgba(255, 255, 255, 0.1))" : "transparent" }}
      aria-hidden={!open}
    >
      <Link
        to="/"
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--shell-accent)] text-sm font-bold text-white shadow-sm transition-colors duration-300"
      >
        K
      </Link>
      {enabled.length > 0 && <div className="h-px w-8 shrink-0 bg-[var(--shell-accent-soft)] transition-colors duration-300" />}
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
    <div
      className={`shell-root flex min-h-dvh ${activeGame === "gtd" ? "gtd-theme" : ""}`}
      data-shell-theme={activeGame ?? "default"}
    >
      <Sidebar open={sidebarOpen} />
      <div className="min-w-0 flex-1">
        <header
          className="shell-surface shell-chrome-font sticky top-0 z-40 border-b-2 transition-colors duration-300"
          style={{ borderBottomColor: "var(--shell-accent)" }}
        >
          {/* Fixed height (not content-driven padding) so the header renders
              at the exact same height on every game, regardless of what's
              in the right-hand cluster (GTD's stat chips/chunky pills vs
              AE/MM2's plainer buttons) - otherwise switching games visibly
              shifts the page. */}
          <div className="flex h-16 items-center gap-1.5 px-4">
            <button
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              className="shell-muted rounded-lg border p-2 transition-colors"
              style={{ borderColor: "var(--panel-border, rgba(255, 255, 255, 0.1))" }}
            >
              <HamburgerIcon className={`size-4 transition-transform duration-300 ease-in-out ${sidebarOpen ? "" : "rotate-180"}`} />
            </button>
            {activeGame && <GameTabs id={activeGame} />}
            <div className="ml-auto flex items-center gap-3">
              {activeGame === "gtd" && <GtdHeaderStats />}
              {activeGame === "ae" && <AeGetScriptButton />}
              {activeGame === "mm2" && <Mm2GetScriptButton />}
              {activeGame === "gtd" && <GtdGetScriptButton />}
              <button
                onClick={() => pb.authStore.clear()}
                className="shell-muted rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
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

  return (
    <Shell>
      <Suspense fallback={<SkeletonGrid count={6} />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/ae/*" element={<AeHome />} />
          <Route path="/mm2/*" element={<Mm2Home />} />
          <Route path="/gtd/*" element={<GtdHome />} />
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
