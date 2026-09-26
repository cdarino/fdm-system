import { Suspense } from 'react';
import { redirect, unstable_rethrow } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordForm } from '@/components/dashboard-settings/change-password-form';
import { PageError } from '@/components/dashboard-layout/page-status';
import { SettingsSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { getUserInfo } from '@/lib/user';
import { getCurrentUserRoleNames } from '@/lib/actions/check-user';
import { roleLabel } from '@/lib/role-labels';

type SettingsData =
  | {
      status: 'ok';
      email: string;
      firstName: string;
      lastName: string;
      roleNames: string[];
    }
  | { status: 'unauthenticated' }
  | { status: 'error' };

/**
 * Returns a status rather than redirecting — `redirect()` throws, so calling it
 * inside the try block would let the catch swallow it. See the admin page.
 */
async function resolveSettings(): Promise<SettingsData> {
  try {
    const user = await getUserInfo();
    if (!user) return { status: 'unauthenticated' };

    // The user's actual assigned roles — not the sidebar sections, which for a
    // system administrator deliberately include every department.
    const roleNames = await getCurrentUserRoleNames();

    const metadata = (user.user_metadata ?? {}) as Record<string, string>;

    return {
      status: 'ok',
      email: user.email ?? '',
      firstName: metadata.first_name ?? '',
      lastName: metadata.last_name ?? '',
      roleNames,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error('Error loading settings page:', error);
    return { status: 'error' };
  }
}

async function SettingsContent() {
  const data = await resolveSettings();

  if (data.status === 'unauthenticated') {
    redirect('/login');
  }

  if (data.status === 'error') {
    return <PageError message="Failed to load settings. Please try again." />;
  }

  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-6 flex-1">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your profile details and account security.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Ask a system administrator to change your name or roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              Name
            </p>
            <p className="text-sm text-foreground">{fullName || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              Email
            </p>
            <p className="text-sm text-foreground break-all">{data.email || '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              Roles
            </p>
            {data.roleNames.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles assigned</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data.roleNames.map((name) => (
                  <Badge
                    key={name}
                    variant="secondary"
                    className="bg-sidebar-accent text-accent-blue-foreground border-transparent hover:bg-sidebar-accent"
                  >
                    {roleLabel(name)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ChangePasswordForm />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <PageContainer>
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </PageContainer>
  );
}
