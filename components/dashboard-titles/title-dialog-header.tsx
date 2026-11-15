'use client';

import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { lotRefLabel, type TitleDialogItem } from '@/lib/hooks/use-land-titles';
import { ClientCallingCard } from '@/components/dashboard-clients/client-calling-card';
import { PropertyCallingCard } from '@/components/dashboard-properties/property-calling-card';
import type { LandTitle } from '@/lib/types/title';

/**
 * The dialog header: who and what this record is, and nothing else.
 *
 * The header has been reduced twice, both times because a thing in it was
 * already being said better somewhere below it.
 *
 * First the five-step workflow strip. It shared this row with the identity
 * cards, and the row did not fit: the cards at their `min-w-[11rem]` floor plus
 * the longest status badge need 537px while the column beside the strip is
 * 522px at `xl`, so the badge wrapped to a second line on 3 of 10 records and
 * the header grew from 89px to 119px. The fix was not to shave pixels but to
 * stop the two competing for the row, so the strip moved to the rail — which
 * shows the same progression against the stage the record is actually in.
 *
 * Then the status badge and the detail sentence. Both restated the pinned
 * `StatusBar` a few pixels below them: the badge showed the same stage label in
 * the same tone, and "Legal compiling buyer file and turnover documents" said
 * nothing the stage name "Document Preparation" had not already said. Two
 * surfaces describing one status is the thing this dialog was built to avoid.
 * What is left is a header whose height depends on the identity cards alone.
 *
 * What must *not* be removed is the pair of `sr-only` Radix elements below.
 * They are the dialog's accessible name and description; without them a screen
 * reader announces a dialog with no title.
 */
export function TitleDialogHeader({ item }: { item: TitleDialogItem }) {
  const title: LandTitle | null = item.type === 'title' ? item.data : null;
  const awaiting = item.type === 'awaiting' ? item.data : null;

  const property = title?.property ?? awaiting?.property;
  const client = title?.client ?? awaiting?.client;
  const clientName = client?.full_name ?? 'Client Account';
  const propertyRef = lotRefLabel(property);

  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        {/*
          The dialog's accessible name, and its description. Both are `sr-only`
          because the cards below carry the same information visually.

          The status badge that used to sit at the end of this row is gone: the
          pinned `StatusBar` below the header states the same stage in the same
          tone. A "Document Preparation" badge and a "Document Preparation" bar
          twelve pixels apart is not emphasis, it is a duplicate — and it was
          the badge that set the row's width budget in the first place.
        */}
        <DialogTitle className="sr-only">
          {propertyRef} - {clientName}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Title record details for {propertyRef} owned by {clientName}
        </DialogDescription>

        {/*
          Both cards are links to their own records, derived from the id they
          are handed, so clicking one leaves the dialog for that client or lot.
          Nothing here has to say so: the derivation is inside the cards.
        */}
        <div className="flex flex-wrap items-center gap-2">
          {property ? (
            <PropertyCallingCard property={property} tier="compact" className="max-w-sm" />
          ) : (
            <span className="text-sm font-semibold">{propertyRef}</span>
          )}
          {client ? (
            <ClientCallingCard client={client} tier="compact" className="max-w-sm" />
          ) : (
            <ClientCallingCard
              client={{ full_name: clientName, client_id: null }}
              tier="compact"
              className="max-w-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}
