import { Suspense } from 'react';
import { UserManagementSection } from '@/components/dashboard-admin/user-management-section';
import { AdminSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { verifyPageAccess } from '@/lib/actions/auth-guard';

async function AdminContent() {
  const { userId } = await verifyPageAccess('system.read');

  return (
    <div className="flex flex-col gap-6 pt-4 sm:pt-8 pb-6 sm:pb-8">
      <h1 className="text-2xl font-bold text-foreground">Administration</h1>
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
