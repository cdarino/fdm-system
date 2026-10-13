import { Suspense } from 'react';
import { UserManagementSection } from '@/components/dashboard-admin/user-management-section';
import { AdminSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { verifyPageAccess } from '@/lib/actions/auth-guard';

async function AdminContent() {
  const { userId } = await verifyPageAccess('system.read');

  return (
    <div className="flex flex-col gap-6 pt-4 sm:pt-8 pb-6 sm:pb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Team &amp; access</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create an employee account, assign their job roles, then confirm their access and account status.</p>
      </div>
      <UserManagementSection currentUserId={userId} />
    </div>
  );
}

export default function AdminPage() {
  return (
    <PageContainer padding="horizontal">
      <Suspense fallback={<AdminSkeleton />}>
        <AdminContent />
      </Suspense>
    </PageContainer>
  );
}
