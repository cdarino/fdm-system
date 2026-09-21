import { DashboardShell } from '@/components/dashboard-layout/dashboard-shell';
import { getUserInfo } from '@/lib/user';
import { getIsCurrentUserSystemAdmin, getCurrentUserRoleSections } from '@/lib/actions/check-user';


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Independent of one another — awaiting them in sequence made the shell wait
  // on three consecutive Supabase round trips before rendering.
  const [user, isSystemAdmin, roleSections] = await Promise.all([
    getUserInfo(),
    getIsCurrentUserSystemAdmin(),
    getCurrentUserRoleSections(),
  ]);

  return (
    <DashboardShell
      user={user}
      isSystemAdmin={isSystemAdmin}
      roleSections={roleSections}
    >
      {children}
    </DashboardShell>
  );
}
