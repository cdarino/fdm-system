import { Suspense } from 'react';
import Link from 'next/link';
import { checkIsSystemAdmin } from '@/lib/actions/check-user';
import { createClient } from '@/lib/supabase/server';
import { QuickLinks } from '@/components/dashboard/quick-links';

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
          <h1 className="text-3xl font-bold text-[#1A1D20]">Welcome to the FDM System</h1>
          <p className="text-[#6C7E8E] mt-2">
            {isSystemAdmin
              ? "You have administrator access. Manage users and system settings from below."
              : "Manage your properties and access reporting tools."}
          </p>
        </div>

        {/* Admin Section - Only visible to System Admins */}
        {isSystemAdmin && (
          <div className="bg-white rounded-2xl p-6 border border-[#E2E7EC] shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#1A1D20]">Administration</h2>
              <p className="text-sm text-[#6C7E8E] mt-1">You have administrator access. Manage users and system settings.</p>
            </div>
            <Link
              href="/dashboard/admin"
              className="px-4 py-2 bg-[#5BC4E7] hover:bg-[#3AAFE0] text-white text-sm font-medium rounded-lg transition-colors"
            >
              Go to Admin Panel
            </Link>
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
          <QuickLinks />
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
