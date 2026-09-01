import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { UserManagementSection } from '@/components/dashboard/user-management-section';
import { checkIsSystemAdmin } from '@/lib/actions/check-user';
import { listUsers } from '@/lib/actions/admin-register';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function AdminContent() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect('/login');
    }

    const isSystemAdmin = await checkIsSystemAdmin(user.id);

    if (!isSystemAdmin) {
      redirect('/dashboard');
    }

    const result = await listUsers();
    const users = result.success ? result.users : [];

    return (
      <div className="flex flex-col gap-6 flex-1">
        <h1 className="text-2xl font-bold text-[#1A1D20]">Administration</h1>
        <UserManagementSection users={users} />
      </div>
    );
  } catch (error) {
    console.error('Error loading admin page:', error);
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-medium">Failed to load admin page. Please try again.</p>
      </div>
    );
  }
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin">
              <div className="w-8 h-8 border-4 border-[#E2E7EC] border-t-[#5BC4E7] rounded-full" />
            </div>
            <p className="mt-4 text-[#6C7E8E]">Loading...</p>
          </div>
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
