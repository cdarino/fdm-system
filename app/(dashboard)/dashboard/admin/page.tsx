import { Suspense } from 'react';
import { redirect, unstable_rethrow } from 'next/navigation';
import { UserManagementSection } from '@/components/dashboard/user-management-section';
import { checkIsSystemAdmin } from '@/lib/actions/check-user';
import { getUserInfo } from '@/lib/user';
import { PageError } from '@/components/dashboard/page-status';
import { AdminSkeleton } from '@/components/dashboard/page-skeletons';


type AdminAccess =
  | { status: 'ok'; userId: string }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'error' };

/**
 * Resolves whether the caller may view the admin panel.
 *
 * Deliberately returns a status instead of redirecting: `redirect()` works by
 * throwing a NEXT_REDIRECT error, so calling it inside this try block would let
 * the catch swallow the redirect and render the generic error state instead.
 * The caller performs the redirect outside of any try/catch.
 */
async function resolveAdminAccess(): Promise<AdminAccess> {
  try {
    const user = await getUserInfo();

    if (!user) {
      return { status: 'unauthenticated' };
    }

    const isSystemAdmin = await checkIsSystemAdmin(user.id);

    return isSystemAdmin ? { status: 'ok', userId: user.id } : { status: 'forbidden' };
  } catch (error) {
    // Re-throw framework-controlled errors (redirect, notFound, dynamic APIs)
    // so Next.js can handle them rather than reporting a page load failure.
    unstable_rethrow(error);
    console.error('Error loading admin page:', error);
    return { status: 'error' };
  }
}

async function AdminContent() {
  const access = await resolveAdminAccess();

  if (access.status === 'unauthenticated') {
    redirect('/login');
  }

  if (access.status === 'forbidden') {
    redirect('/dashboard');
  }

  if (access.status === 'error') {
    return <PageError message="Failed to load admin page. Please try again." />;
  }

  return (
    <div className="flex flex-col gap-6 flex-1">
      <h1 className="text-2xl font-bold text-foreground">Administration</h1>
      <UserManagementSection currentUserId={access.userId} />
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminContent />
    </Suspense>
  );
}
