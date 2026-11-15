import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/dashboard-layout/page-container";
import { PropertiesSkeleton } from "@/components/dashboard-layout/page-skeletons";
import { BillingLedgerDetailView } from "@/components/dashboard-billing/billing-ledger-detail-view";
import { verifyPageAccess } from "@/lib/actions/auth-guard";
import { getBillingLedgerById } from "@/lib/actions/billing";

export const dynamic = "force-dynamic";

interface BillingDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function LedgerDetailContent({ id }: { id: string }) {
  await verifyPageAccess("billing.read");

  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const { ledger } = await getBillingLedgerById(id, todayStr);
    return (
      <div className="pt-4 sm:pt-8 pb-6 sm:pb-8">
        <BillingLedgerDetailView initialLedger={ledger} asOfDate={todayStr} />
      </div>
    );
  } catch {
    notFound();
  }
}

export default async function BillingDetailPage({ params }: BillingDetailPageProps) {
  const { id } = await params;

  return (
    <PageContainer padding="horizontal">
      <Suspense fallback={<PropertiesSkeleton />}>
        <LedgerDetailContent id={id} />
      </Suspense>
    </PageContainer>
  );
}
