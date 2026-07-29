export function StatChip({
  icon,
  iconClass,
  value,
  label,
  valueClass,
}: {
  icon: React.ReactNode;
  iconClass: string;
  value: string;
  label: string;
  valueClass?: string;
}) {
  return (
    <div className="stat-chip">
      <div className={`chip-icon ${iconClass}`}>{icon}</div>
      <div className="chip-text">
        <span className={`chip-value ${valueClass ?? ""}`}>{value}</span>
        <span className="chip-label">{label}</span>
      </div>
    </div>
  );
}
