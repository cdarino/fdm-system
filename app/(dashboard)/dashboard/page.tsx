import { Suspense } from 'react';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { checkIsSystemAdmin } from '@/lib/actions/check-user';
import { getUserInfo } from '@/lib/user';
import { QuickLinks } from '@/components/dashboard-overview/quick-links';
import { PageError } from '@/components/dashboard-layout/page-status';
import { getDashboardStats } from '@/lib/actions/dashboard';
import { DashboardSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';


async function DashboardContent() {
  try {
    const user = await getUserInfo();

    if (!user) {
      return <PageError message="Please log in to access the dashboard" />;
    }

    const [isSystemAdmin, stats] = await Promise.all([
      checkIsSystemAdmin(user.id),
      getDashboardStats(),
    ]);

    // Only tiles the user is allowed to see; see DashboardStats for why a
    // withheld stat is null rather than 0.
    // `stats.propertyLots === null` means the user may not read properties, so
    // it doubles as the gate for the Property Lots quick link below.
    const tiles = [
      { label: 'Property Lots', value: stats.propertyLots, icon: '🗺️', tint: 'bg-sidebar-accent' },
      { label: 'Available Lots', value: stats.availableLots, icon: '🏷️', tint: 'bg-chart-4' },
      { label: 'Clients', value: stats.clients, icon: '👥', tint: 'bg-sidebar-accent' },
    ].filter((tile): tile is typeof tile & { value: number } => tile.value !== null);

    return (
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-sidebar-accent to-chart-4 rounded-2xl p-8 border border-border">
          <h1 className="text-3xl font-bold text-foreground">Welcome to the FDM System</h1>
          <p className="text-muted-foreground mt-2">
            {isSystemAdmin
              ? "You have administrator access. Manage users and system settings from below."
              : "Manage your properties and access reporting tools."}
          </p>
        </div>

        {/* Admin Section - Only visible to System Admins */}
        {isSystemAdmin && (
          <div className="bg-card text-card-foreground rounded-2xl p-6 border border-border shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Administration</h2>
              <p className="text-sm text-muted-foreground mt-1">You have administrator access. Manage users and system settings.</p>
            </div>
            <Link
              href="/dashboard/admin"
              className="px-4 py-2 bg-primary hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)] text-primary-foreground text-sm font-medium rounded-lg transition-colors"
            >
              Go to Admin Panel
            </Link>
          </div>
        )}

        {/* Regular Dashboard Content */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>

          {/* Stats Grid */}
          {tiles.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {tiles.map((tile) => (
                <div
                  key={tile.label}
                  className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{tile.label}</p>
                      <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                        {tile.value.toLocaleString()}
                      </p>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl ${tile.tint}`}>
                      {tile.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
              No overview figures are available for your role.
            </div>
          )}

          {/* Recent Activity */}
          <QuickLinks canViewProperties={stats.propertyLots !== null} />
        </div>
      </div>
    );
  } catch (error) {
    // Re-throw framework-controlled errors (redirect, notFound, dynamic APIs)
    // so Next.js can handle them rather than reporting a page load failure.
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
