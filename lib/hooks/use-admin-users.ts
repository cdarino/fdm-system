'use client';

import { createContext, createElement, useContext, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  listUsers,
  registerUser,
  toggleUser as toggleUserAction,
  deleteUser as deleteUserAction,
  updateUserProfile as updateUserProfileAction,
} from '@/lib/actions/admin-user';
import type { UserListItem, RegisterUserParams } from '@/lib/actions/admin-user';
import { getActiveRoles, setUserRoles as setUserRolesAction } from '@/lib/actions/admin-roles';
import type { RbacRole } from '@/lib/actions/admin-roles';
import { roleLabel } from '@/lib/role-labels';

export type StatusFilter = 'all' | 'active' | 'inactive';

export type AdminDialog =
  | { type: 'create' }
  | { type: 'edit-name'; user: UserListItem }
  | { type: 'edit-roles'; user: UserListItem }
  | { type: 'toggle'; user: UserListItem }
  | { type: 'delete'; user: UserListItem }
  | null;

interface AdminUsersContextValue {
  users: UserListItem[];
  roles: RbacRole[];
  isLoading: boolean;
  error: string | null;
  /** The signed-in admin, so the UI can disable actions against their own account. */
  currentUserId: string;
  selectedUserId: string | null;
  selectedUser: UserListItem | null;
  activeDialog: AdminDialog;
  search: string;
  setSearch: (query: string) => void;
  roleFilter: string | null;
  setRoleFilter: (roleId: string | null) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (status: StatusFilter) => void;
  visibleUsers: UserListItem[];
  selectUser: (id: string | null) => void;
  openDialog: (dialog: AdminDialog) => void;
  closeDialog: () => void;
  createUser: (params: RegisterUserParams) => Promise<void>;
  updateUserName: (userId: string, firstName: string, lastName: string) => Promise<void>;
  updateUserRoles: (userId: string, roleIds: string[]) => Promise<void>;
  toggleUserStatus: (userId: string, isBanned: boolean) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

const AdminUsersContext = createContext<AdminUsersContextValue | null>(null);

export function useAdminUsers() {
  const ctx = useContext(AdminUsersContext);
  if (!ctx) throw new Error('useAdminUsers must be used within AdminUsersProvider');
  return ctx;
}

function matchesSearch(user: UserListItem, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const fields = [
    user.email,
    user.firstName,
    user.lastName,
    ...user.roles.map((r) => roleLabel(r.name)),
  ]
    .filter(Boolean)
    .map((field) => field.toLowerCase());

  return words.every((word) => fields.some((field) => field.includes(word)));
}

export function AdminUsersProvider({
  children,
  currentUserId,
}: {
  children: ReactNode;
  currentUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<AdminDialog>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  const visibleUsers = useMemo(() => {
    return users.filter((user) => {
      if (!matchesSearch(user, search)) return false;
      if (roleFilter && !user.roles.some((r) => r.id === roleFilter)) return false;
      if (statusFilter === 'active' && user.isBanned) return false;
      if (statusFilter === 'inactive' && !user.isBanned) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  useEffect(() => {
    Promise.all([listUsers(), getActiveRoles()])
      .then(([usersResult, rolesResult]) => {
        setUsers(usersResult.users);
        setRoles(rolesResult);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setIsLoading(false));
  }, []);

  function selectUser(id: string | null) {
    setSelectedUserId(id);
  }

  function openDialog(dialog: AdminDialog) {
    setActiveDialog(dialog);
  }

  function closeDialog() {
    setActiveDialog(null);
  }

  async function createUser(params: RegisterUserParams): Promise<void> {
    const result = await registerUser(params);
    const newUser: UserListItem = {
      id: result.userId,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      roles: roles
        .filter((r) => (params.roleIds ?? []).includes(r.id))
        .map(({ id, name }) => ({ id, name })),
      isBanned: false,
    };
    setUsers((prev) => [newUser, ...prev.filter((u) => u.id !== newUser.id)]);
    router.refresh();
  }

  async function updateUserName(userId: string, firstName: string, lastName: string): Promise<void> {
    await updateUserProfileAction(userId, firstName, lastName);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, firstName, lastName } : u)));
    router.refresh();
  }

  async function updateUserRoles(userId: string, roleIds: string[]): Promise<void> {
    await setUserRolesAction(userId, roleIds);
    const updatedRoles = roles
      .filter((r) => roleIds.includes(r.id))
      .map(({ id, name }) => ({ id, name }));
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, roles: updatedRoles } : u)));
    router.refresh();
  }

  async function toggleUserStatus(userId: string, isBanned: boolean): Promise<void> {
    await toggleUserAction(userId, isBanned);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isBanned: !isBanned } : u)));
    router.refresh();
  }

  async function deleteUser(userId: string): Promise<void> {
    await deleteUserAction(userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    if (selectedUserId === userId) setSelectedUserId(null);
    router.refresh();
  }

  const value: AdminUsersContextValue = {
    users,
    roles,
    isLoading,
    error,
    currentUserId,
    selectedUserId,
    selectedUser,
    activeDialog,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    visibleUsers,
    selectUser,
    openDialog,
    closeDialog,
    createUser,
    updateUserName,
    updateUserRoles,
    toggleUserStatus,
    deleteUser,
  };

  return createElement(AdminUsersContext.Provider, { value }, children);
}
