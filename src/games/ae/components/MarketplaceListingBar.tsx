import { useState } from "react";
import { useAccount, useAccountDetails } from "../hooks/useAccountDetail";
import { buildDefaultDescription, buildDefaultTitle } from "../lib/eldoradoDescribe";
import { EldoradoListingModal } from "./EldoradoListingModal";
import { ZeusXListingModal } from "./ZeusXListingModal";
import { BulkAutoListModal } from "./eldorado/BulkAutoListModal";

/**
 * "List on Eldorado"/"List on ZeusX" action bar + the modals they open —
 * factored out of UnitsPage.tsx's UnitOwnersModal (same buttons, same
 * single-vs-bulk Eldorado split, same ZeusX single-modal-with-multiple-ids
 * shape) so other selectable-accounts lists (Autoswap, Processed Accounts)
 * can reuse the exact same listing flow instead of re-implementing it.
 */
export function MarketplaceListingBar({
  usernames,
  userIds,
  fallbackTitle,
  fallbackDescription,
  onDone,
}: {
  /** Usernames of the selected accounts — prefills Automatic-delivery blobs on Eldorado. */
  usernames: string[];
  /** user_ids of the selected accounts — marked "listed" once publish succeeds. */
  userIds: number[];
  fallbackTitle?: string;
  fallbackDescription?: string;
  /** Called whenever either modal closes (success or cancel) — hook this to refresh whatever "listed" list is showing this bar. */
  onDone?: () => void;
}) {
  const [eldoradoOpen, setEldoradoOpen] = useState(false);
  const [zeusxOpen, setZeusxOpen] = useState(false);

  // Only fetch full account data (for the showcase auto-attach) when exactly one account is selected.
  const soloUserId = userIds.length === 1 ? userIds[0] : null;
  const soloAccount = useAccount(soloUserId);
  const soloDetails = useAccountDetails(soloUserId);

  if (userIds.length === 0) return null;

  const title = soloAccount.data ? buildDefaultTitle(soloAccount.data) : fallbackTitle;
  const description = soloAccount.data
    ? buildDefaultDescription(soloAccount.data, soloDetails.data)
    : fallbackDescription;

  function closeEldorado(): void {
    setEldoradoOpen(false);
    onDone?.();
  }
  function closeZeusx(): void {
    setZeusxOpen(false);
    onDone?.();
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setEldoradoOpen(true)}
          className="rounded-md border border-fuchsia-300 bg-white px-2 py-1 text-[11px] font-semibold text-fuchsia-600 transition-colors hover:border-fuchsia-400 dark:border-fuchsia-500/40 dark:bg-white/5 dark:text-fuchsia-400"
        >
          {userIds.length > 1 ? `Bulk list on Eldorado (${userIds.length})` : "List on Eldorado"}
        </button>
        <button
          onClick={() => setZeusxOpen(true)}
          className="rounded-md border border-fuchsia-300 bg-white px-2 py-1 text-[11px] font-semibold text-fuchsia-600 transition-colors hover:border-fuchsia-400 dark:border-fuchsia-500/40 dark:bg-white/5 dark:text-fuchsia-400"
        >
          List on ZeusX
        </button>
      </div>

      {eldoradoOpen && userIds.length > 1 && <BulkAutoListModal usernames={usernames} onClose={closeEldorado} />}

      {eldoradoOpen && userIds.length <= 1 && (
        <EldoradoListingModal
          initialTitle={title}
          initialDescription={description}
          initialAccountUsernames={usernames.length > 0 ? usernames : undefined}
          showcaseAccount={soloAccount.data ? { account: soloAccount.data, details: soloDetails.data } : undefined}
          listingUserIds={userIds}
          onClose={closeEldorado}
        />
      )}

      {zeusxOpen && (
        <ZeusXListingModal
          initialTitle={title}
          initialDescription={description}
          showcaseAccount={soloAccount.data ? { account: soloAccount.data, details: soloDetails.data } : undefined}
          listingUserIds={userIds}
          onClose={closeZeusx}
        />
      )}
    </>
  );
}
