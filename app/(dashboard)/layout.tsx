import { DashboardShell } from '@/components/dashboard-layout/dashboard-shell';
import { getUserSession } from '@/lib/session';
import { SessionProvider } from '@/lib/hooks/use-session';
import { getRecentActivity } from '@/lib/actions/recent-activity';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, recentActivity] = await Promise.all([
    getUserSession(),
    getRecentActivity(),
  ]);

  return (
    <SessionProvider session={session}>
      <DashboardShell
        user={session.user}
        recentActivity={recentActivity}
      >
        {children}
      </DashboardShell>
    </SessionProvider>
  );
}
