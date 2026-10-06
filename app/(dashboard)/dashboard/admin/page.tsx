import { Suspense } from 'react';
import { UserManagementSection } from '@/components/dashboard-admin/user-management-section';
import { AdminSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { verifyPageAccess } from '@/lib/actions/auth-guard';

async function AdminContent() {
  const { userId } = await verifyPageAccess('system.read');

  return (
    <div className="flex flex-col gap-6 flex-1">
      <h1 className="text-2xl font-bold text-foreground">Administration</h1>
      <UserManagementSection currentUserId={userId} />
    </div>
  );
}

export default function AdminPage() {
  return (
    <PageContainer>
      <Suspense fallback={<AdminSkeleton />}>
        <AdminContent />
      </Suspense>
    </PageContainer>
  );
}
