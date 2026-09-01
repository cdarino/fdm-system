import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { DashboardTopBar } from '@/components/dashboard/top-bar';
import { FdmLogo } from '@/components/fdm-logo';
import { getUserInfo } from '@/lib/user';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserInfo();
  return (
    <div className="min-h-screen bg-[#F5F3EC]">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-[#E2E7EC] overflow-y-auto">
        <div className="p-4 border-b border-[#E2E7EC]">
          <div className="flex items-center space-x-2">
            <FdmLogo className="h-12 w-16 object-contain flex-shrink-0" />
            <span className="font-bold text-[#1A1D20]">First Davao Millennium<br/>Property Ventures Inc.</span>
          </div>
        </div>
        <SidebarNav />
      </div>

      {/* Main Content */}
      <div className="ml-60 flex flex-col h-screen">
        <DashboardTopBar userEmail={user?.email} />
        <main className="flex-1 overflow-auto">
          <div className="p-8 flex flex-col min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
