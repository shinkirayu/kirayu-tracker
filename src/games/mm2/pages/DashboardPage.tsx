import { useEffect, useMemo, useRef, useState } from "react";
import { useAccounts, useDashboardStats } from "../hooks/useAccounts";
import { useAccountsRealtime } from "../hooks/useAccountsRealtime";
import { useDeleteAccounts } from "../hooks/useDeleteAccounts";
import { useDebounce } from "../../../hooks/useDebounce";
import type { AccountFilters } from "../lib/types";
import { loadColumnPrefs, saveColumnPrefs, type ColumnPrefs } from "../lib/columnPrefs";
import { AccountRow } from "../components/AccountRow";
import { AccountCard } from "../components/AccountCard";
import { FilterBar } from "../components/FilterBar";
import { StatTiles } from "../components/StatTiles";
import { SkeletonGrid, SkeletonTiles } from "../../../components/Skeletons";
import { TrackerHealth } from "../../../components/TrackerHealth";

export default function DashboardPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 350);
  const [filters, setFilters] = useState<AccountFilters>({
    search: "",
    sort: "username",
    onlineOnly: false,
    inRoundOnly: false,
  });
  const effectiveFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch.trim() }),
    [filters, debouncedSearch],
  );

  const [columns, setColumns] = useState<ColumnPrefs>(() => loadColumnPrefs());
  useEffect(() => saveColumnPrefs(columns), [columns]);

  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAccounts(effectiveFilters);
  const stats = useDashboardStats();
  const deleteAccounts = useDeleteAccounts();

  const accounts = useMemo(() => data?.pages.flatMap((p) => p.rows) ?? [], [data]);
  useAccountsRealtime();

  const hasActiveFilters = filters.onlineOnly || filters.inRoundOnly || effectiveFilters.search.length > 0;
  function clearFilters() {
    setSearchInput("");
    setFilters({ search: "", sort: filters.sort, onlineOnly: false, inRoundOnly: false });
  }

  const [selected, setSelected] = useState<Set<number>>(new Set());
  function toggleSelect(userId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function handleDelete() {
    const ids = [...selected];
    const names = ids
      .map((id) => accounts.find((a) => a.user_id === id)?.username)
      .filter((n): n is string => !!n);
    const ok = window.confirm(
      `Stop tracking ${ids.length} account${ids.length > 1 ? "s" : ""}?\n\n${names.join(", ")}\n\nThis removes them from the dashboard entirely and cannot be undone.`,
    );
    if (!ok) return;
    deleteAccounts.mutate(ids, { onSuccess: () => setSelected(new Set()) });
  }

  // Infinite scroll sentinel.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="space-y-6">
      {stats.data ? <StatTiles stats={stats.data} /> : <SkeletonTiles />}
      <TrackerHealth reports={accounts} />

      <FilterBar
        searchInput={searchInput}
        onSearchInput={setSearchInput}
        filters={filters}
        onFilters={setFilters}
        onClear={clearFilters}
        loadedCount={accounts.length}
        columns={columns}
        onColumns={setColumns}
      />

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 dark:border-red-500/15 dark:bg-red-500/10">
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDelete}
              disabled={deleteAccounts.isPending}
              className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:border-red-400 disabled:opacity-50 dark:border-red-500/25 dark:bg-white/5 dark:text-red-400"
            >
              {deleteAccounts.isPending ? "Deleting…" : "Delete"}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-500/10 dark:text-red-300">
          <span>Failed to load accounts: {(error as Error)?.message}</span>
          <button
            onClick={() => void refetch()}
            className="shrink-0 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-400/40 dark:bg-red-950 dark:text-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <SkeletonGrid />
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-red-500/15">
          {hasActiveFilters ? (
            <>
              <p>No accounts match your current filters.</p>
              <button
                onClick={clearFilters}
                className="mt-3 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/5"
              >
                Clear filters
              </button>
            </>
          ) : (
            "No accounts yet. Waiting for trackers to report in…"
          )}
        </div>
      ) : (
        <>
          {/* Below md, a wide table can only ever scroll sideways — stack cards instead. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
            {accounts.map((a) => (
              <AccountCard
                key={a.user_id}
                account={a}
                columns={columns}
                selected={selected.has(a.user_id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-sm md:block dark:border-red-500/10 dark:bg-white/[0.03]">
            <table className="w-full min-w-[1000px] table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] tracking-wide text-red-700/70 uppercase dark:border-red-500/10 dark:text-red-300/60">
                  <th className="py-3 pr-0 pl-4 font-semibold">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-3 pr-3 pl-3 font-semibold">Account</th>
                  <th className="px-3 py-3 text-center font-semibold">Level</th>
                  {columns.coins && <th className="px-3 py-3 text-center font-semibold">Coins</th>}
                  {columns.shells && <th className="px-3 py-3 text-center font-semibold">Seashells</th>}
                  {columns.xp && <th className="px-3 py-3 text-center font-semibold">XP</th>}
                  {columns.weapons && <th className="px-3 py-3 text-center font-semibold">Weapons</th>}
                  {columns.pets && <th className="px-3 py-3 text-center font-semibold">Pets</th>}
                  {columns.effects && <th className="px-3 py-3 text-center font-semibold">Effects</th>}
                  {columns.toys && <th className="px-3 py-3 text-center font-semibold">Toys</th>}
                  {columns.emotes && <th className="px-3 py-3 text-center font-semibold">Emotes</th>}
                  {columns.radios && <th className="px-3 py-3 text-center font-semibold">Radios</th>}
                  {columns.materials && <th className="px-3 py-3 text-center font-semibold">Materials</th>}
                  {columns.presence && <th className="px-3 py-3 text-center font-semibold">Round / Role</th>}
                  <th className="py-3 pr-4 pl-3 text-right font-semibold">Last update</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <AccountRow
                    key={a.user_id}
                    account={a}
                    columns={columns}
                    selected={selected.has(a.user_id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div ref={sentinelRef} className="h-1" />
          {isFetchingNextPage && <SkeletonGrid count={3} />}
        </>
      )}
    </div>
  );
}
