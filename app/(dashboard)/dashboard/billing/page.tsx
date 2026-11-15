import { Suspense } from "react";
import { PageContainer } from "@/components/dashboard-layout/page-container";
import { PropertiesSkeleton } from "@/components/dashboard-layout/page-skeletons";
import { BillingDashboardView } from "@/components/dashboard-billing/billing-dashboard-view";
import { verifyPageAccess } from "@/lib/actions/auth-guard";
import { getBillingLedgers } from "@/lib/actions/billing";

export const dynamic = "force-dynamic";

async function BillingContent() {
  await verifyPageAccess("billing.read");
  const todayStr = new Date().toISOString().split("T")[0];
  const summaries = await getBillingLedgers(todayStr);

  return (
    <div className="pt-4 sm:pt-8 pb-6 sm:pb-8">
      <BillingDashboardView initialSummaries={summaries} initialAsOfDate={todayStr} />
    </div>
  );
}

export default function BillingPage() {
  return (
    <PageContainer padding="horizontal">
      <Suspense fallback={<PropertiesSkeleton />}>
        <BillingContent />
      </Suspense>
    </PageContainer>
  );
}
