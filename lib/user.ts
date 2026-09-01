import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/permissions';

export interface UserRole {
  id: string;
  name: string;
  description: string | null;
}

export async function getUserInfo() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
  };
}

export async function isSystemAdmin(userId: string): Promise<boolean> {
  return hasPermission('system.create', userId);
}

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const supabase = await createClient();

  const { data: roles, error } = await supabase
    .schema('rbac')
    .from('user_role')
    .select('role_id, role:rbac_role(id, name, description)')
    .eq('user_id', userId);

  if (error || !roles) {
    console.error('Error fetching user roles:', error);
    return [];
  }

  const roleRows = roles as Array<{ role: UserRole[] | null }>;
  return roleRows.flatMap((row) => row.role ?? []);
}
