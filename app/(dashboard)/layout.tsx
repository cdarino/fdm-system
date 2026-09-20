import { SidebarNav } from '@/components/dashboard-layout/sidebar-nav';
import { DashboardTopBar } from '@/components/dashboard-layout/top-bar';
import { FdmLogo } from '@/components/shared/fdm-logo';
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
    <div className="min-h-screen bg-background">
      {/* Sidebar. Flex column so the branding block keeps its height and the
          nav below it takes the remaining space and scrolls on short screens. */}
      <div className="fixed left-0 top-0 bottom-0 w-60 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border shrink-0">
          <div className="flex flex-col items-center space-y-2">
            <FdmLogo className="h-24 w-40 object-contain flex-shrink-0" />
            <span className="font-bold text-foreground text-center">First Davao Millennium<br/>Property Ventures Inc.</span>
          </div>
        </div>
        <SidebarNav isSystemAdmin={isSystemAdmin} roleSections={roleSections} />
      </div>

      {/* Main Content */}
      <div className="ml-60 flex flex-col h-screen">
        <DashboardTopBar user={user} />
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
