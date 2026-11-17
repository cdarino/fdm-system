import { Suspense } from 'react';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import {
  CalendarDays,
  Briefcase,
  Layers,
} from 'lucide-react';
import {
  checkIsSystemAdmin,
  getCurrentUserRoleNames,
} from '@/lib/actions/check-user';
import { getUserInfo } from '@/lib/user';
import { getDashboardOverview } from '@/lib/actions/dashboard-overview';
import { getAccountsAwaitingTitle, getLandTitles } from '@/lib/actions/titles';
import { getBillingLedgers } from '@/lib/actions/billing';
import { hasPermission } from '@/lib/permissions';
import { getRecentActivity } from '@/lib/actions/recent-activity';
import { getWelcomeActions } from '@/lib/welcome-actions';
import { DashboardSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { PageError } from '@/components/dashboard-layout/page-status';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { calculateStorageFee } from '@/lib/storage-fee';
import { formatActivityTime } from '@/lib/format-activity-time';
import {
  documentsForLot,
  getMissingReleaseDocuments,
  getRequiredReleaseDocuments,
} from '@/lib/utils/release-requirements';
import type { LandTitle } from '@/lib/types/title';
import { DailyWorkflowCard } from '@/components/dashboard-overview/daily-workflow-card';
import { UniversalActivityCard } from '@/components/dashboard-overview/universal-activity-card';
import {
  BillingActionCard,
  type BillingDueSoonItem,
  type BillingOverdueItem,
} from '@/components/dashboard-overview/billing-action-card';
import {
  TitleActionCard,
  type TitleActionQueue,
  type TitleActionRecord,
} from '@/components/dashboard-overview/title-action-card';
import { ClientFollowUps } from '@/components/dashboard-overview/client-follow-ups';
import { PropertyPortfolioCard } from '@/components/dashboard-overview/property-portfolio-card';

const ROLE_FOCUS: Record<string, { description: string }> = {
  system_admin: {
    description:
      'Review incomplete records, monitor the property portfolio, and keep your team’s access up to date.',
  },
  admin_staff: {
    description:
      'Find longstanding client records, complete missing paperwork, and keep contact information ready for follow-ups.',
  },
  billing_staff: {
    description:
      'Manage buyer installment schedules, official receipts, penalty computations, and clearances.',
  },
  accounting_staff: {
    description:
      'Use client and property records to support your account reviews and reconciliation preparation.',
  },
  legal_staff: {
    description:
      'Review the next title-processing stage, clear document requirements, and record each approval through physical handover.',
  },
};

function latestNoticeLabel(title: LandTitle): string | null {
  const notices = title.notices ?? [];
  if (notices.length === 0) return null;
  const latest = [...notices].sort((a, b) => b.notice_number - a.notice_number)[0];
  const nth =
    latest.notice_number === 1 ? '1st' : latest.notice_number === 2 ? '2nd' : 'Final';
  if (latest.status === 'returned_to_sender') return `${nth} notice returned to sender`;
  if (latest.status === 'received') return `${nth} notice received`;
  return `${nth} notice ongoing`;
}

function DashboardHeader() {
  const formattedDate = new Date().toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          FDM workspace
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Dashboard</h1>
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        {formattedDate}
      </p>
    </div>
  );
}

async function DashboardContent() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return <PageError message="Please log in to access the dashboard" />;
    }

    // Parallel fetch of user status, core stats, and permissions
    const [
      isSystemAdmin,
      stats,
      roles,
      canReadBilling,
      canReadTitles,
      canReadClients,
      canReadProperties,
      activity,
    ] = await Promise.all([
      checkIsSystemAdmin(user.id),
      getDashboardOverview(),
      getCurrentUserRoleNames(),
      hasPermission('billing.read', user.id),
      hasPermission('legal.read', user.id),
      hasPermission('clients.read', user.id),
      hasPermission('properties.read', user.id),
      getRecentActivity(),
    ]);

    // Fetch billing action lists when authorized
    let billingData: { dueSoon: BillingDueSoonItem[]; overdue: BillingOverdueItem[] } = {
      dueSoon: [],
      overdue: [],
    };
    if (canReadBilling) {
      try {
        const summaries = await getBillingLedgers();
        const dueSoon: BillingDueSoonItem[] = [];
        const overdue: BillingOverdueItem[] = [];

        for (const s of summaries) {
          const clientName = s.ledger.client?.fullName ?? 'Unknown client';
          const lotRef = `${s.ledger.property.projectArea || 'Property'} · B${s.ledger.property.blockNumber} L${s.ledger.property.lotNumber}`;

          if (s.status === 'due_soon' || (s.daysUntilDue >= 0 && s.daysUntilDue <= 15 && s.status !== 'settled')) {
            dueSoon.push({
              id: s.ledger.id,
              name: clientName,
              lot: lotRef,
              due: s.currentTermDueDate
                ? new Date(s.currentTermDueDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                : 'Upcoming',
              amount: s.currentTermBalance || s.totalPayableNow,
              daysLeft: `${s.daysUntilDue} days left`,
            });
          }

          if (s.status === 'overdue' || s.monthsOverdue > 0) {
            const stage =
              s.ledger.overdueEscalation?.currentStage === 'second_notice'
                ? '2nd Notice'
                : s.ledger.overdueEscalation?.currentStage === 'final_demand'
                  ? 'Final Demand'
                  : s.ledger.overdueEscalation?.currentStage === 'first_notice'
                    ? '1st Notice'
                    : 'In Arrears';

            overdue.push({
              id: s.ledger.id,
              name: clientName,
              lot: lotRef,
              overdueMonths: `${s.monthsOverdue} ${s.monthsOverdue === 1 ? 'mo' : 'mos'} overdue`,
              amount: s.overdueAndPenaltyDue || s.totalPayableNow,
              stage,
            });
          }
        }

        billingData = { dueSoon, overdue };
      } catch (err) {
        console.error('Failed to load billing ledgers for dashboard:', err);
      }
    }

    // Fetch title release queues when authorized
    let titleData: { queues: TitleActionQueue[]; releasedCount: number } = {
      queues: [],
      releasedCount: 0,
    };
    if (canReadTitles) {
      try {
        const [readyRes, awaitingList, prepRes, reviewRes, releasedRes] = await Promise.all([
          getLandTitles({ limit: 5, status: 'Ready for Claim', sortBy: 'updated_at', sortOrder: 'desc' }),
          getAccountsAwaitingTitle(),
          getLandTitles({ limit: 5, status: 'Document Preparation', sortBy: 'updated_at', sortOrder: 'desc' }),
          getLandTitles({ limit: 5, status: 'For Review', sortBy: 'updated_at', sortOrder: 'desc' }),
          getLandTitles({ limit: 1, status: 'Released' }),
        ]);

        const readyRecords: TitleActionRecord[] = readyRes.data.map((t) => {
          const notice = latestNoticeLabel(t);
          const fee = calculateStorageFee(t);
          let state = 'Original title in vault';
          let isAlert = false;

          if (notice) {
            state = notice;
            isAlert = notice.includes('returned to sender');
          } else if (fee.isOverdue) {
            state = `${fee.monthsOverdue} ${fee.monthsOverdue === 1 ? 'mo' : 'mos'} overdue`;
            isAlert = true;
          }

          return {
            id: t.title_id,
            name: t.client?.full_name ?? 'Unknown client',
            lot: `${t.property?.location ?? 'Property'} · Block ${t.property?.block_number} Lot ${t.property?.lot_number}`,
            state,
            statusTab: 'ready',
            isAlert,
          };
        });

        const intakeRecords: TitleActionRecord[] = awaitingList.slice(0, 5).map((a) => ({
          id: a.account_id,
          name: a.client?.full_name ?? 'Unknown client',
          lot: `${a.property.location} · Block ${a.property.block_number} Lot ${a.property.lot_number}`,
          state: `Cleared ${formatActivityTime(a.cleared_at)}`,
          statusTab: 'intake',
        }));

        const prepRecords: TitleActionRecord[] = prepRes.data.map((t) => {
          const uploaded = documentsForLot(t.client?.documents ?? [], t.property_id).map((d) => d.file_category);
          const required = getRequiredReleaseDocuments(t.is_legacy_transferred).length;
          const missing = getMissingReleaseDocuments(t.is_legacy_transferred, uploaded).length;
          const docsDone = required - missing;
          const isComplete = missing === 0 && Boolean(t.property?.title_number?.trim());

          return {
            id: t.title_id,
            name: t.client?.full_name ?? 'Unknown client',
            lot: `${t.property?.location ?? 'Property'} · Block ${t.property?.block_number} Lot ${t.property?.lot_number}`,
            state: isComplete ? `Packet complete (${required}/${required})` : `${docsDone} of ${required} documents`,
            statusTab: 'preparation',
          };
        });

        const reviewRecords: TitleActionRecord[] = reviewRes.data.map((t) => ({
          id: t.title_id,
          name: t.client?.full_name ?? 'Unknown client',
          lot: `${t.property?.location ?? 'Property'} · Block ${t.property?.block_number} Lot ${t.property?.lot_number}`,
          state: 'Packet complete (6/6)',
          statusTab: 'review',
        }));

        titleData = {
          queues: [
            { key: 'ready', label: 'Ready for claim', count: readyRes.totalCount, records: readyRecords },
            { key: 'intake', label: 'Billing cleared', count: awaitingList.length, records: intakeRecords },
            { key: 'preparation', label: 'Document preparation', count: prepRes.totalCount, records: prepRecords },
            { key: 'review', label: 'Supervisor verification', count: reviewRes.totalCount, records: reviewRecords },
          ],
          releasedCount: releasedRes.totalCount,
        };
      } catch (err) {
        console.error('Failed to load title queues for dashboard:', err);
      }
    }

    const focus = isSystemAdmin
      ? ROLE_FOCUS.system_admin
      : roles.length > 1
        ? {
            description:
              'Stay on top of client records and property activity across your assigned departments.',
          }
        : ROLE_FOCUS[roles[0]] ?? {
            description:
              'Your assigned tools and accessible records will appear here. Contact your administrator if you need additional access.',
          };

    const welcomeActions = getWelcomeActions(isSystemAdmin, roles);
    const fullName =
      typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name.trim()
        : '';
    const firstName = fullName.split(/\s+/)[0];

    // Compute row visibility and auto-expansion flags
    const hasWindDown = canReadBilling || canReadTitles;
    const isWindDownFull = canReadBilling !== canReadTitles;

    const hasRecordsAndPortfolio = canReadClients || canReadProperties;
    const isRow3Full = canReadClients !== canReadProperties;

    const permissions = {
      canReadClients,
      canReadProperties,
      canReadBilling,
      canReadTitles,
    };

    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-6">
        <DashboardHeader />

        {/* Welcome Banner */}
        <Card className="flex flex-col gap-4 border-l-4 border-l-primary p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Welcome back{firstName ? `, ${firstName}` : ''}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{focus.description}</p>
          </div>
          {welcomeActions.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {welcomeActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button key={action.href} asChild size="sm" variant={action.variant}>
                    <Link href={action.href}>
                      <Icon className="h-4 w-4" />
                      <span>{action.label}</span>
                    </Link>
                  </Button>
                );
              })}
            </div>
          )}
        </Card>

        {/* ROW 1: WORKSPACE WORKFLOW + RECENT ACTIVITY */}
        <section aria-label="Workflow & Activity Hub">
          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            <DailyWorkflowCard permissions={permissions} />
            <UniversalActivityCard initialItems={activity} />
          </div>
        </section>

        {/* ROW 2: WIND-DOWN OPERATIONS (Billing & Titles) */}
        {hasWindDown && (
          <section aria-labelledby="wind-down-heading" className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <Briefcase className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <h2 id="wind-down-heading" className="text-base font-semibold tracking-tight text-foreground">
                Wind-Down Operations
              </h2>
            </div>

            <div
              className={cn(
                'grid items-stretch gap-6',
                isWindDownFull ? 'grid-cols-1' : 'lg:grid-cols-2'
              )}
            >
              {canReadBilling && (
                <BillingActionCard
                  isFullWidth={isWindDownFull}
                  dueSoonAccounts={billingData.dueSoon}
                  overdueAccounts={billingData.overdue}
                />
              )}
              {canReadTitles && (
                <TitleActionCard
                  isFullWidth={isWindDownFull}
                  queues={titleData.queues}
                  totalReleasedCount={titleData.releasedCount}
                />
              )}
            </div>
          </section>
        )}

        {/* ROW 3: CLIENT RECORDS & PROPERTY PORTFOLIO */}
        {hasRecordsAndPortfolio && (
          <section aria-labelledby="records-properties-heading" className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <Layers className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <h2 id="records-properties-heading" className="text-base font-semibold tracking-tight text-foreground">
                Records &amp; Property Portfolio
              </h2>
            </div>

            <div
              className={cn(
                'grid items-stretch gap-6',
                isRow3Full ? 'grid-cols-1' : 'lg:grid-cols-2'
              )}
            >
              {canReadClients && (
                <ClientFollowUps
                  isFullWidth={isRow3Full}
                  items={stats.clientFollowUps}
                />
              )}
              {canReadProperties && (
                <PropertyPortfolioCard
                  isFullWidth={isRow3Full}
                  preview={stats.mapPreview}
                  statuses={stats.lotStatuses}
                />
              )}
            </div>
          </section>
        )}
      </div>
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error('Error loading dashboard:', error);
    return <PageError message="Failed to load dashboard. Please try again." />;
  }
}

export default function DashboardPage() {
  return (
    <PageContainer>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </PageContainer>
  );
}
