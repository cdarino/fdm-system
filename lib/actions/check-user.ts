'use server';

import { hasPermission } from '@/lib/permissions';

export async function checkIsSystemAdmin(userId: string): Promise<boolean> {
  return hasPermission('system.create', userId);
}
