'use server';

import { hasPermission } from '@/lib/permissions';

export async function checkIsSystemAdmin(userId: string): Promise<boolean> {
  return hasPermission('system.create', userId);
}

export async function getIsCurrentUserSystemAdmin(): Promise<boolean> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return hasPermission('system.create', user.id);
}
