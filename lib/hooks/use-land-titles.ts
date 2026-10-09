'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStatusFilter } from '@/lib/hooks/use-status-filter';
import { createLandTitle, updateLandTitle } from '@/lib/actions/titles';
import type { ActionResult } from '@/lib/actions/action-result';
import type { AccountAwaitingTitle, LandTitle } from '@/lib/types/title';
import type { TitleRecordFormData } from '@/lib/validations/title';

/** 'awaiting': accounts cleared by Billing with no title yet. 'titles': title records. */
export type LegalTab = 'awaiting' | 'titles';

const TABS: LegalTab[] = ['awaiting', 'titles'];

type LotRef = { block_number: number; lot_number: number } | null | undefined;

/** Lot identity as staff say it out loud: "Block 3 Lot 12". */
export function lotRefLabel(lot: LotRef): string {
  return lot ? `Block ${lot.block_number} Lot ${lot.lot_number}` : 'Lot not found';
}

function matchesSearch(fields: string[], query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields.map((field) => field.toLowerCase());
  return words.every((word) => haystack.some((field) => field.includes(word)));
}

/**
 * Sole owner of the land title server actions for the Legal page. Components
 * under `components/dashboard-titles/` use this instead of importing from
 * `lib/actions/` directly.
 */
export function useLandTitles(initialTitles: LandTitle[], initialAwaiting: AccountAwaitingTitle[]) {
  const router = useRouter();
  const [titles, setTitles] = useState(initialTitles);
  const [awaiting, setAwaiting] = useState(initialAwaiting);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useStatusFilter<LegalTab>(TABS, 'awaiting');

  // A router.refresh() brings new server data. Adopt it.
  useEffect(() => setTitles(initialTitles), [initialTitles]);
  useEffect(() => setAwaiting(initialAwaiting), [initialAwaiting]);

  const visibleAwaiting = useMemo(
    () =>
      awaiting.filter((account) =>
        matchesSearch(
          [
            account.client?.full_name ?? '',
            ...account.co_buyers,
            account.property.location,
            lotRefLabel(account.property),
          ],
          search
        )
      ),
    [awaiting, search]
  );

  const visibleTitles = useMemo(
    () =>
      titles.filter((title) =>
        matchesSearch(
          [
            title.client?.full_name ?? '',
            title.title_number ?? '',
            title.property?.location ?? '',
            lotRefLabel(title.property),
          ],
          search
        )
      ),
    [titles, search]
  );

  const createTitle = useCallback(
    async (propertyId: string, input: TitleRecordFormData): Promise<ActionResult<LandTitle>> => {
      const result = await createLandTitle({ property_id: propertyId, ...input });
      if (result.success) {
        setAwaiting((prev) => prev.filter((a) => a.property.property_id !== propertyId));
        setTitles((prev) => [result.data, ...prev]);
        router.refresh();
      }
      return result;
    },
    [router]
  );

  const editTitle = useCallback(
    async (titleId: string, input: TitleRecordFormData): Promise<ActionResult<LandTitle>> => {
      const result = await updateLandTitle(titleId, input);
      if (result.success) {
        setTitles((prev) => prev.map((t) => (t.title_id === titleId ? result.data : t)));
        router.refresh();
      }
      return result;
    },
    [router]
  );

  return {
    titles,
    awaiting,
    visibleTitles,
    visibleAwaiting,
    search,
    setSearch,
    tab,
    setTab,
    createTitle,
    editTitle,
  };
}
