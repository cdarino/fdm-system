import { Suspense } from 'react';
import { redirect, unstable_rethrow } from 'next/navigation';
import { PropertyLotsSection } from '@/components/dashboard/property-lots-section';
import { PageError } from '@/components/dashboard/page-status';
import { PropertiesSkeleton } from '@/components/dashboard/page-skeletons';
import { hasPermission } from '@/lib/permissions';
import { getUserInfo } from '@/lib/user';

type PropertiesAccess =
  | { status: 'ok' }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'error' };

/** Returns a status whether the user's access is granted */
async function resolveAccess(): Promise<PropertiesAccess> {
  try {
    const user = await getUserInfo();
    if (!user) return { status: 'unauthenticated' };

    const allowed = await hasPermission('properties.read', user.id);
    return allowed ? { status: 'ok' } : { status: 'forbidden' };
  } catch (error) {
    unstable_rethrow(error);
    console.error('Error loading properties page:', error);
    return { status: 'error' };
  }
}

async function PropertiesContent() {
  const access = await resolveAccess();

  if (access.status === 'unauthenticated') {
    redirect('/login');
  }

  if (access.status === 'forbidden') {
    redirect('/dashboard');
  }

  if (access.status === 'error') {
    return <PageError message="Failed to load property lots. Please try again." />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Property Lots</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Raw land inventory across the company&apos;s sites.
        </p>
      </div>
      <PropertyLotsSection />
    </div>
  );
}

export default function PropertiesPage() {
  return (
    <Suspense fallback={<PropertiesSkeleton />}>
      <PropertiesContent />
    </Suspense>
  );
}
