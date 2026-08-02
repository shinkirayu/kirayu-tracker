import { Link } from "react-router-dom";
import { GAMES, type GameId } from "../lib/pocketbase";
import { useDashboardStats as useAeDashboardStats } from "../games/ae/hooks/useAccounts";
import { useDashboardStats as useMm2DashboardStats } from "../games/mm2/hooks/useAccounts";
import { useGtdDashboardStats } from "../games/gtd/hooks/useGtdDashboardStats";

function fmt(n: number | null | undefined): string {
  return Math.floor(n || 0).toLocaleString("en-US");
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-white/[0.03] px-5 py-4">
      <div className="text-2xl font-extrabold tabular-nums text-white">{value}</div>
      <div className="mt-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</div>
    </div>
  );
}

function GameCard({
  id,
  online,
  total,
  extraLabel,
  extraValue,
  loading,
}: {
  id: GameId;
  online: number;
  total: number;
  extraLabel: string;
  extraValue: string;
  loading: boolean;
}) {
  const game = GAMES[id];
  return (
    <Link
      to={`/${id}`}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${game.accent} p-5 text-white shadow-lg transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-xl`}
    >
      <div className="text-xs font-semibold tracking-wide text-white/70 uppercase">{game.short}</div>
      <div className="mt-1 text-lg font-bold">{game.label}</div>
      <div className="mt-4 flex items-end gap-6">
        <div>
          <div className="text-2xl font-extrabold tabular-nums">{loading ? "—" : fmt(online)}</div>
          <div className="text-xs text-white/70">Online / {loading ? "—" : fmt(total)}</div>
        </div>
        <div>
          <div className="text-2xl font-extrabold tabular-nums">{loading ? "—" : extraValue}</div>
          <div className="text-xs text-white/70">{extraLabel}</div>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const ae = useAeDashboardStats();
  const mm2 = useMm2DashboardStats();
  const gtd = useGtdDashboardStats();

  const totalAccounts = (ae.data?.total ?? 0) + (mm2.data?.total ?? 0) + gtd.total;
  const totalOnline = (ae.data?.online ?? 0) + (mm2.data?.online ?? 0) + gtd.online;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold text-white">Kirayu</h1>
      <p className="mb-6 text-sm text-zinc-500">Everything you're tracking, at a glance.</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Total Accounts" value={fmt(totalAccounts)} />
        <SummaryTile label="Online Now" value={fmt(totalOnline)} />
        <SummaryTile label="GTD Total Seeds" value={fmt(gtd.totalSeeds)} />
        <SummaryTile label="GTD Seeds Today" value={(gtd.totalSeedsToday > 0 ? "+" : "") + fmt(gtd.totalSeedsToday)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <GameCard
          id="ae"
          online={ae.data?.online ?? 0}
          total={ae.data?.total ?? 0}
          extraLabel="In Match"
          extraValue={fmt(ae.data?.in_match)}
          loading={ae.isLoading}
        />
        <GameCard
          id="mm2"
          online={mm2.data?.online ?? 0}
          total={mm2.data?.total ?? 0}
          extraLabel="In Round"
          extraValue={fmt(mm2.data?.in_round)}
          loading={mm2.isLoading}
        />
        <GameCard
          id="gtd"
          online={gtd.online}
          total={gtd.total}
          extraLabel="Total Seeds"
          extraValue={fmt(gtd.totalSeeds)}
          loading={gtd.isLoading}
        />
      </div>
    </div>
  );
}
