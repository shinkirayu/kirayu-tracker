import { UnitIcon } from "./UnitIcon";
import { rarityClass } from "../lib/unitRarity";
import type { Rarity } from "../lib/types";

/** Small picture-card used by the Ban/Buy/Trade unit pickers — same visual language as the Inventory grid, shrunk to fit a sidebar column. */
export function UnitCardMini({
  unitId,
  name,
  rarity,
  image,
  statusIcon,
  statusClass,
  badge,
  onClick,
}: {
  unitId: string;
  name: string;
  rarity: Rarity;
  image?: string | null;
  statusIcon: string;
  statusClass?: string;
  badge?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      className={`unit-card unit-card-mini ${rarityClass(rarity)} ${statusClass ?? ""}`}
      title={name}
      onClick={onClick}
    >
      <UnitIcon image={image} rawName={unitId} />
      <span className="status-badge">{statusIcon}</span>
      {badge}
      <div className="unit-title">{name}</div>
    </div>
  );
}
