import { Suspense } from 'react';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { ArrowRight, CalendarDays, LandPlot, Users, Archive, BriefcaseBusiness, ShieldCheck } from 'lucide-react';
import { checkIsSystemAdmin, getCurrentUserRoleNames, getCurrentUserRoleSections } from '@/lib/actions/check-user';
import { getUserInfo } from '@/lib/user';
import { roleLabel } from '@/lib/role-labels';
import { QuickLinks } from '@/components/dashboard-overview/quick-links';
import { PropertyMapCard } from '@/components/dashboard-overview/property-map-card';
import { PortfolioChart } from '@/components/dashboard-overview/portfolio-charts';
import { ClientFollowUps } from '@/components/dashboard-overview/client-follow-ups';
import { PageError } from '@/components/dashboard-layout/page-status';
import { getDashboardOverview } from '@/lib/actions/dashboard-overview';
import { DashboardSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const ROLE_FOCUS: Record<string, { title: string; description: string }> = {
  system_admin: { title: 'A clear view across your organization', description: 'Review incomplete records, monitor the property portfolio, and keep your team’s access up to date.' },
  admin_staff: { title: 'Keep everyday operations moving', description: 'Find longstanding client records, complete missing paperwork, and keep contact information ready for follow-ups.' },
  billing_staff: { title: 'Start with the right client records', description: 'Review client profiles and property assignments as you prepare for billing work.' },
  accounting_staff: { title: 'Your records, ready for review', description: 'Use client and property records to support your account reviews and reconciliation preparation.' },
  legal_staff: { title: 'Keep client documentation in view', description: 'Open client profiles to review documents and verify their assigned properties.' },
};

// FIXME: who the FUCK reads code horizontally, ever heard of variables, or functions!?
// FIXME: VARIANTS!!

async function DashboardContent() {
  try {
    const user = await getUserInfo();
    if (!user) return <PageError message="Please log in to access the dashboard" />;
    const [isSystemAdmin, stats, roles, sections] = await Promise.all([
      checkIsSystemAdmin(user.id), getDashboardOverview(), getCurrentUserRoleNames(), getCurrentUserRoleSections(),
    ]);
    const focus = isSystemAdmin ? ROLE_FOCUS.system_admin : roles.length > 1
      ? { title: 'Your work, all in one place', description: 'Stay on top of client records and property activity across your assigned departments.' }
      : ROLE_FOCUS[roles[0]] ?? { title: 'Welcome to your workspace', description: 'Your assigned tools and accessible records will appear here. Contact your administrator if you need additional access.' };
    const fullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
    const firstName = fullName.split(/\s+/)[0];
    const tiles = [
      { label: 'Total property lots', value: stats.propertyLots, href: '/dashboard/properties', detail: 'View all property lots', icon: LandPlot, visible: stats.canReadProperties, tint: 'bg-sidebar-accent text-accent-blue-foreground' },

      { label: 'Total clients', value: stats.clients, href: '/dashboard/clients?status=all-records', detail: 'View all client records', icon: Users, visible: stats.canReadClients, tint: 'bg-sidebar-accent text-accent-blue-foreground' },
      { label: 'Active clients', value: stats.activeClients, href: '/dashboard/clients?status=Active', detail: 'View active clients', icon: BriefcaseBusiness, visible: stats.canReadClients, tint: 'bg-chart-4 text-accent-gold-foreground' },
    ].filter(tile => tile.visible);
    const departments = sections.filter(section => section.tabs.some(tab => tab.comingSoon));
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">FDM workspace</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1></div><p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" />{new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}</p></div>
        <Card variant="prominent" padding="lg" className="relative overflow-hidden bg-gradient-to-br from-sidebar-accent via-card to-[color-mix(in_srgb,var(--secondary)_12%,var(--card))]">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[32px] border-[color-mix(in_srgb,var(--primary)_12%,transparent)]" />
          <div className="relative flex flex-wrap items-center justify-between gap-6"><div className="max-w-2xl"><div className="mb-4 flex flex-wrap gap-2">{roles.length ? roles.map(role => <Badge key={role} variant="outline" className="bg-card">{roleLabel(role)}</Badge>) : <Badge variant="outline">Your workspace</Badge>}</div><p className="text-sm text-muted-foreground">Welcome back{firstName ? `, ${firstName}` : ''}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{focus.title}</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{focus.description}</p></div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            {isSystemAdmin && (
              <Button asChild size="lg">
                <Link href="/dashboard/admin">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                  Manage team
                </Link>
              </Button>
            )}
          </div>
          </div>
        </Card>
        {tiles.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{tiles.map(({ icon: Icon, ...tile }) => <Link key={tile.label} href={tile.href} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Card variant="interactive" padding="default" className="h-full group-hover:border-primary"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-muted-foreground">{tile.label}</p><div className={`rounded-lg p-2 ${tile.tint}`}><Icon className="h-5 w-5" /></div></div><p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{tile.value === null ? 'Unavailable' : tile.value.toLocaleString()}</p><p className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">{tile.detail}<ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" /></p></Card></Link>)}</div>}
        {(stats.canReadProperties || stats.canReadClients) && <div className="grid items-start gap-6 lg:grid-cols-2">{stats.canReadClients && <ClientFollowUps items={stats.clientFollowUps} />}{stats.canReadProperties && <div className="space-y-6"><PropertyMapCard preview={stats.mapPreview} /><PortfolioChart statuses={stats.lotStatuses} /></div>}</div>}
        <QuickLinks canViewProperties={stats.canReadProperties} canViewClients={stats.canReadClients} isSystemAdmin={isSystemAdmin} />
        <div className="grid gap-6 lg:grid-cols-3">
          {stats.canReadClients && <Card className="lg:col-span-2"><CardHeader className="flex-row flex-wrap items-center justify-between gap-3"><div><CardTitle>Recently updated client records</CardTitle><CardDescription className="mt-2">Resume reviewing recently maintained profiles</CardDescription></div><Link href="/dashboard/clients" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">View all<ArrowRight className="h-4 w-4" /></Link></CardHeader><CardContent>
            {stats.recentClients === null ? <p className="py-8 text-sm text-muted-foreground">Recent clients are temporarily unavailable.</p> : stats.recentClients.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No clients yet. Client records will appear here as they are maintained.</p> : <ul className="divide-y divide-border">{stats.recentClients.map(client => <li key={client.client_id} className="flex flex-wrap items-center gap-3 py-3"><div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-accent-blue-foreground">{client.full_name.split(/\s+/).slice(0, 2).map(word => word[0]).join('')}</div><div className="min-w-0 flex-1"><Link href={`/dashboard/clients?client=${encodeURIComponent(client.client_id)}`} className="inline-flex items-center gap-1 break-words rounded text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{client.full_name}<ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0" /></Link><p className="mt-1 text-xs text-muted-foreground">{new Date(client.updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}</p></div><Badge variant="outline">{client.status}</Badge></li>)}</ul>}
          </CardContent></Card>}
          <div className={`space-y-6 ${!stats.canReadClients ? 'lg:col-span-3' : ''}`}>
            {stats.canReadClients && <Link href="/dashboard/clients?status=Archived" className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card variant="interactive" padding="default" className="group-hover:border-primary"><div className="flex items-center gap-2"><Archive className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold">Archived records</h2></div><p className="mt-3 text-2xl font-semibold tabular-nums">{stats.archivedClients?.toLocaleString() ?? 'Unavailable'}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Review archived client records.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-medium">Open archive<ArrowRight aria-hidden="true" className="h-4 w-4" /></span></Card></Link>}
            {departments.length > 0 && <Card padding="default"><h2 className="text-sm font-semibold">Department tools</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Title tracking, billing, and payment workflows are not available yet. Use client profiles for supporting records in the meantime.</p><ul className="mt-4 space-y-4">{departments.flatMap(section => section.tabs.filter(tab => tab.comingSoon).map(tab => <li key={tab.href}><p className="text-sm font-medium">{tab.title}</p><p className="mt-1 text-xs text-muted-foreground">{section.category} · Under development</p></li>))}</ul></Card>}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error('Error loading dashboard:', error);
    return <PageError message="Failed to load dashboard. Please try again." />;
  }
}

export default function DashboardPage() {
  return <PageContainer><Suspense fallback={<DashboardSkeleton />}><DashboardContent /></Suspense></PageContainer>;
}
