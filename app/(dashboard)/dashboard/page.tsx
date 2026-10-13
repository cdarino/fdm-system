import { Suspense } from 'react';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  LandPlot,
  Users,
  BriefcaseBusiness,
  FileCheck2,
  type LucideIcon,
} from 'lucide-react';
import {
  checkIsSystemAdmin,
  getCurrentUserRoleNames,
} from '@/lib/actions/check-user';
import { getUserInfo } from '@/lib/user';
import { QuickLinks } from '@/components/dashboard-overview/quick-links';
import { PropertyMapCard } from '@/components/dashboard-overview/property-map-card';
import { PortfolioChart } from '@/components/dashboard-overview/portfolio-charts';
import { ClientFollowUps } from '@/components/dashboard-overview/client-follow-ups';
import { PageError } from '@/components/dashboard-layout/page-status';
import { getDashboardOverview } from '@/lib/actions/dashboard-overview';
import { getAccountsAwaitingTitle, getLandTitles } from '@/lib/actions/titles';
import { hasPermission } from '@/lib/permissions';
import { getRecentActivity } from '@/lib/actions/recent-activity';
import { ActivityFeed } from '@/components/dashboard-overview/activity-feed';
import { DashboardSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
      'Review client profiles and property assignments as you prepare for billing work.',
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

interface StatTile {
  label: string;
  value: number | null;
  href: string;
  detail: string;
  icon: LucideIcon;
  visible: boolean;
  tint: string;
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

function TitleWorkflowOverview({
  stageCounts,
  awaitingCount,
}: {
  stageCounts: Record<'preparation' | 'review' | 'signature' | 'clearance' | 'ready' | 'released', number>;
  awaitingCount: number;
}) {
  const counts = [
    { label: 'Needs preparation', value: stageCounts.preparation, status: 'preparation' },
    { label: 'In verification', value: stageCounts.review, status: 'review' },
    { label: 'Awaiting signature', value: stageCounts.signature, status: 'signature' },
    { label: 'In clearance', value: stageCounts.clearance, status: 'clearance' },
    { label: 'Ready for claim', value: stageCounts.ready, status: 'ready' },
    { label: 'Released', value: stageCounts.released, status: 'released' },
  ];
  const openWork = awaitingCount + counts.slice(0, 5).reduce((total, stage) => total + stage.value, 0);
  const nextQueue = [
    { value: awaitingCount, label: 'Billing-cleared accounts', status: 'intake', detail: 'Create the title record to begin legal processing.' },
    { value: stageCounts.preparation, label: 'Document preparation', status: 'preparation', detail: 'Complete the title number and required release packet.' },
    { value: stageCounts.review, label: 'Supervisor verification', status: 'review', detail: 'Review the legal description and turnover documents.' },
    { value: stageCounts.signature, label: 'Executive signature', status: 'signature', detail: 'Confirm signing and notarization before clearance.' },
    { value: stageCounts.clearance, label: '30-day clearance', status: 'clearance', detail: 'Monitor titles until the internal clearance period ends.' },
    { value: stageCounts.ready, label: 'Client claim follow-up', status: 'ready', detail: 'Contact clients and record notice delivery or title handover.' },
  ].find((queue) => queue.value > 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_16%,white)] text-accent-blue-foreground">
            <FileCheck2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Land title processing</p>
            <h2 className="mt-1 text-lg font-semibold">Title release pipeline</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {openWork} title{openWork === 1 ? '' : 's'} need attention before release.
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/dashboard/legal">
            Open title processing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      {nextQueue && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-row-hover px-5 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next step · {nextQueue.label}</p>
            <p className="mt-0.5 text-xs text-foreground">{nextQueue.detail}</p>
          </div>
          <Button asChild variant="quiet" size="sm" className="shrink-0 gap-1.5">
            <Link href={`/dashboard/legal?status=${nextQueue.status}`}>
              Open this queue
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4 lg:grid-cols-7">
        <Link href="/dashboard/legal?status=intake" className="bg-card p-4 transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5">
          <p className="text-xs font-medium text-muted-foreground">Billing cleared</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{awaitingCount.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">Awaiting title record</p>
        </Link>
        {counts.map((stage) => (
          <Link key={stage.label} href={`/dashboard/legal?status=${stage.status}`} className="bg-card p-4 transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5">
            <p className="text-xs font-medium text-muted-foreground">{stage.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{stage.value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">Open queue</p>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function DashboardStatTiles({ tiles }: { tiles: StatTile[] }) {
  if (tiles.length === 0) return null;

  return (
    <div
      className={cn(
        'grid gap-4 sm:grid-cols-2',
        tiles.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
      )}
    >
      {tiles.map(({ icon: Icon, ...tile }) => (
        <Link
          key={tile.label}
          href={tile.href}
          className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card
            variant="interactive"
            className="h-full p-5 sm:p-6 group-hover:border-primary"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">{tile.label}</p>
              <div className={cn('rounded-lg p-2', tile.tint)}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
              {tile.value === null ? 'Unavailable' : tile.value.toLocaleString()}
            </p>
            <p className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              {tile.detail}
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
              />
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

async function DashboardContent() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return <PageError message="Please log in to access the dashboard" />;
    }

    const [isSystemAdmin, stats, roles, canReadTitles, activity] = await Promise.all([
      checkIsSystemAdmin(user.id),
      getDashboardOverview(),
      getCurrentUserRoleNames(),
      hasPermission('legal.read', user.id),
      getRecentActivity(),
    ]);

    const titleOverview = canReadTitles
      ? await Promise.all([
          ...([
            ['preparation', 'Document Preparation'],
            ['review', 'For Review'],
            ['signature', 'For Signature'],
            ['clearance', 'Clearance Period'],
            ['ready', 'Ready for Claim'],
            ['released', 'Released'],
          ] as const).map(async ([key, status]) => {
            const result = await getLandTitles({ limit: 1, status, sortBy: 'created_at', sortOrder: 'desc' });
            return [key, result.totalCount] as const;
          }),
          getAccountsAwaitingTitle(),
        ])
      : null;

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

    const fullName =
      typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name.trim()
        : '';
    const firstName = fullName.split(/\s+/)[0];

    const tiles: StatTile[] = [
      {
        label: 'Total property lots',
        value: stats.propertyLots,
        href: '/dashboard/properties',
        detail: 'View all property lots',
        icon: LandPlot,
        visible: stats.canReadProperties,
        tint: 'bg-sidebar-accent text-accent-blue-foreground',
      },
      {
        label: 'Total clients',
        value: stats.clients,
        href: '/dashboard/clients?status=all-records',
        detail: 'View all client records',
        icon: Users,
        visible: stats.canReadClients,
        tint: 'bg-sidebar-accent text-accent-blue-foreground',
      },
      {
        label: 'Active clients',
        value: stats.activeClients,
        href: '/dashboard/clients?status=Active',
        detail: 'View active clients',
        icon: BriefcaseBusiness,
        visible: stats.canReadClients,
        tint: 'bg-chart-4 text-accent-gold-foreground',
      },
    ].filter((tile) => tile.visible);

    const hasOperationalSection = stats.canReadProperties || stats.canReadClients;

    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-4">
        <DashboardHeader />

        <Card className="border-l-4 border-l-primary p-4 sm:p-5">
          <p className="text-sm font-semibold text-foreground">Welcome back{firstName ? `, ${firstName}` : ''}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{focus.description}</p>
        </Card>

        <QuickLinks
          canViewProperties={stats.canReadProperties}
          canViewClients={stats.canReadClients}
          canViewTitles={canReadTitles}
        />

        <DashboardStatTiles tiles={tiles} />

        <div className="grid items-start gap-6 lg:grid-cols-2">
          {stats.canReadClients && <ClientFollowUps items={stats.clientFollowUps} />}
          <ActivityFeed initialItems={activity} />
        </div>

        {titleOverview && (
          <TitleWorkflowOverview
            stageCounts={Object.fromEntries(titleOverview.slice(0, 6)) as Record<'preparation' | 'review' | 'signature' | 'clearance' | 'ready' | 'released', number>}
            awaitingCount={titleOverview[6].length}
          />
        )}

        {hasOperationalSection && stats.canReadProperties && (
          <section aria-labelledby="property-portfolio-heading" className="space-y-4">
            <div>
              <h2 id="property-portfolio-heading" className="text-lg font-semibold tracking-tight text-foreground">
                Property portfolio
              </h2>
              <p className="text-sm text-muted-foreground">
                Map layout and inventory availability across company sites.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <PropertyMapCard preview={stats.mapPreview} />
              <PortfolioChart statuses={stats.lotStatuses} />
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
