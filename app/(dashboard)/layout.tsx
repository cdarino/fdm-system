import { DashboardShell } from '@/components/dashboard-layout/dashboard-shell';
import { getUserSession } from '@/lib/session';
import { SessionProvider } from '@/lib/hooks/use-session';
import { getCurrentUserRoleSections } from '@/lib/actions/check-user';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch session and role sections in parallel to avoid sequential round trips.
  const [session, roleSections] = await Promise.all([
    getUserSession(),
    getCurrentUserRoleSections(),
  ]);

  return (
    <SessionProvider session={session}>
      <DashboardShell
        user={session.user}
        roleSections={roleSections}
      >
        {children}
      </DashboardShell>
    </SessionProvider>
  );
}
