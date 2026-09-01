import { Suspense } from 'react';
import { UserManagementSection } from '@/components/dashboard/user-management-section';
import { checkIsSystemAdmin } from '@/lib/actions/check-user';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function DashboardContent() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return (
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Please log in to access the dashboard</p>
        </div>
      );
    }

    // Check if user has system.create permission (system admin)
    const isSystemAdmin = await checkIsSystemAdmin(user.id);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-[#E2F4FA] to-[#FFF9E5] rounded-2xl p-8 border border-[#E2E7EC]">
        <h1 className="text-3xl font-bold text-[#1A1D20]">Welcome to FDM System</h1>
        <p className="text-[#6C7E8E] mt-2">
          {isSystemAdmin
            ? "You have administrator access. Manage users and system settings from below."
            : "Manage your properties and access reporting tools."}
        </p>
      </div>

      {/* Admin Section - Only visible to System Admins */}
      {isSystemAdmin && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-[#1A1D20]">Administration</h2>
          <UserManagementSection />
        </div>
      )}

      {/* Regular Dashboard Content */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-[#1A1D20]">Dashboard Overview</h2>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-[#E2E7EC] shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6C7E8E] font-medium">Total Properties</p>
                <p className="text-3xl font-bold text-[#1A1D20] mt-2">12</p>
              </div>
              <div className="w-12 h-12 bg-[#E2F4FA] rounded-lg flex items-center justify-center text-2xl">
                🏢
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-[#E2E7EC] shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6C7E8E] font-medium">Active Projects</p>
                <p className="text-3xl font-bold text-[#1A1D20] mt-2">8</p>
              </div>
              <div className="w-12 h-12 bg-[#FFF9E5] rounded-lg flex items-center justify-center text-2xl">
                📊
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-[#E2E7EC] shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6C7E8E] font-medium">Team Members</p>
                <p className="text-3xl font-bold text-[#1A1D20] mt-2">5</p>
              </div>
              <div className="w-12 h-12 bg-[#E2F4FA] rounded-lg flex items-center justify-center text-2xl">
                👥
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl p-6 border border-[#E2E7EC] shadow-sm">
          <h3 className="text-lg font-bold text-[#1A1D20] mb-4">Quick Links</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 bg-[#E2F4FA] hover:bg-[#D0ECFA] rounded-lg text-[#5BC4E7] font-medium transition-colors">
              View Properties
            </button>
            <button className="p-4 bg-[#FFF9E5] hover:bg-[#FFEFCC] rounded-lg text-[#F5CE42] font-medium transition-colors">
              View Reports
            </button>
            <button className="p-4 bg-[#F0F5F9] hover:bg-[#E0EBF3] rounded-lg text-[#6C7E8E] font-medium transition-colors">
              Settings
            </button>
            <button className="p-4 bg-[#F0F5F9] hover:bg-[#E0EBF3] rounded-lg text-[#6C7E8E] font-medium transition-colors">
              Help & Support
            </button>
          </div>
        </div>
      </div>
    </div>
    );
  } catch (error) {
    console.error('Error loading dashboard:', error);
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-medium">Failed to load dashboard. Please try again.</p>
      </div>
    );
  }
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin">
              <div className="w-8 h-8 border-4 border-[#E2E7EC] border-t-[#5BC4E7] rounded-full" />
            </div>
            <p className="mt-4 text-[#6C7E8E]">Loading dashboard...</p>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
