import { Suspense } from 'react';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { PropertiesSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { TitleRecordsSection } from '@/components/dashboard-titles/title-records-section';
import { verifyPageAccess } from '@/lib/actions/auth-guard';
import { getAccountsAwaitingTitle, getLandTitles } from '@/lib/actions/titles';

export const dynamic = 'force-dynamic';

async function LegalContent() {
  await verifyPageAccess('legal.read');

  // Everything ships with the first render. The page searches it in the
  // browser, the same way the property lots table does.
  const [titles, awaiting] = await Promise.all([
    getLandTitles({ limit: 500, sortBy: 'created_at', sortOrder: 'desc' }),
    getAccountsAwaitingTitle(),
  ]);

  return (
    <div className="flex flex-col gap-6 pt-4 sm:pt-8 pb-6 sm:pb-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Title releases</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow each billing-cleared account from document preparation to client handover.
        </p>
      </div>
      <TitleRecordsSection initialTitles={titles.data} initialAwaiting={awaiting} />
    </div>
  );
}

export default function LegalPage() {
  return (
    <PageContainer padding="horizontal">
      <Suspense fallback={<PropertiesSkeleton />}>
        <LegalContent />
      </Suspense>
    </PageContainer>
  );
}
