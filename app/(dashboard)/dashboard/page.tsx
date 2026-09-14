import { Suspense } from 'react';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { checkIsSystemAdmin } from '@/lib/actions/check-user';
import { getUserInfo } from '@/lib/user';
import { QuickLinks } from '@/components/dashboard/quick-links';
import { PageError } from '@/components/dashboard/page-status';
import { DashboardSkeleton } from '@/components/dashboard/page-skeletons';


async function DashboardContent() {
  try {
    const user = await getUserInfo();

    if (!user) {
      return <PageError message="Please log in to access the dashboard" />;
    }

    // Check if user has system.create permission (system admin)
    const isSystemAdmin = await checkIsSystemAdmin(user.id);

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card text-card-foreground rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Properties</p>
                  <p className="text-3xl font-bold text-foreground mt-2">12</p>
                </div>
                <div className="w-12 h-12 bg-sidebar-accent rounded-lg flex items-center justify-center text-2xl">
                  🏢
                </div>
              </div>
            </div>

            <div className="bg-card text-card-foreground rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Active Projects</p>
                  <p className="text-3xl font-bold text-foreground mt-2">8</p>
                </div>
                <div className="w-12 h-12 bg-chart-4 rounded-lg flex items-center justify-center text-2xl">
                  📊
                </div>
              </div>
            </div>

            <div className="bg-card text-card-foreground rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Team Members</p>
                  <p className="text-3xl font-bold text-foreground mt-2">5</p>
                </div>
                <div className="w-12 h-12 bg-sidebar-accent rounded-lg flex items-center justify-center text-2xl">
                  👥
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <QuickLinks />
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
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
