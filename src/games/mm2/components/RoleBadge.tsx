const ROLE_STYLES: Record<string, string> = {
  murderer: "bg-red-600/15 text-red-600 dark:text-red-400 border-red-600/30",
  sheriff: "bg-sky-600/15 text-sky-600 dark:text-sky-400 border-sky-600/30",
  innocent: "bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border-emerald-600/30",
};

/** Colored pill for MM2's three round roles — falls back to a neutral style for unrecognized values. */
export function RoleBadge({ role }: { role: string | null | undefined }) {
  if (!role) return null;
  const style = ROLE_STYLES[role.toLowerCase()] ?? "bg-zinc-500/15 text-zinc-500 border-zinc-500/30";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style}`}>{role}</span>
  );
}
