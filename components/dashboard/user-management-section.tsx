'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Settings2, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreateUserModal } from './create-user-modal';
import { getActiveRoles, setUserRoles, toggleUser } from '@/lib/actions/admin-register';
import type { RbacRole, UserListItem } from '@/lib/actions/admin-register';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

interface Props {
  users: UserListItem[];
}

function RoleBadges({ roles }: { roles: UserListItem['roles'] }) {
  if (roles.length === 0) return <span className="text-[#6C7E8E]">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <Badge
          key={role.id}
          variant="secondary"
          className="bg-[#E2F4FA] text-[#3AAFE0] border-transparent hover:bg-[#E2F4FA]"
        >
          {role.name}
        </Badge>
      ))}
    </div>
  );
}

function ToggleUserDialog({ user, open, onOpenChange }: { user: UserListItem; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [isToggling, setIsToggling] = useState(false);

  async function handleConfirm() {
    setIsToggling(true);
    await toggleUser(user.id, user.isBanned);
    setIsToggling(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {user.isBanned ? 'Activate user?' : 'Deactivate user?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {user.isBanned
              ? <>This will restore access for <strong>{user.email}</strong>. They will be able to log in immediately.</>
              : <>This will block access for <strong>{user.email}</strong>. They will be unable to log in until reactivated.</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isToggling}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isToggling}
            onClick={handleConfirm}
            className={user.isBanned ? 'bg-[#5BC4E7] hover:bg-[#4AADE0] text-white' : 'bg-destructive hover:bg-destructive/90 text-white'}
          >
            {isToggling ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving...</> : user.isBanned ? 'Activate' : 'Deactivate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UserRow({ user, isSelected, onClick }: { user: UserListItem; isSelected: boolean; onClick: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <TableRow
        key={user.id}
        className={`group cursor-pointer transition-colors ${isSelected ? 'bg-[#F0F9FD]' : 'hover:bg-[#F9FAFB]'}`}
        onClick={onClick}
      >
        <TableCell className="font-medium text-[#1A1D20]">{user.email}</TableCell>
        <TableCell><RoleBadges roles={user.roles} /></TableCell>
        <TableCell>
          <div className="flex items-center justify-between gap-2">
            <div>
              {user.isBanned ? (
                <Badge variant="destructive" className="border-transparent">Inactive</Badge>
              ) : (
                <Badge className="bg-green-100 text-green-700 border-transparent hover:bg-green-100">Active</Badge>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Open user actions"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded-md hover:bg-[#F3F4F6]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4 text-[#6C7E8E]" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[160px]">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmOpen(true);
                  }}
                >
                  {user.isBanned ? 'Activate user' : 'Deactivate user'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      <ToggleUserDialog user={user} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </>
  );
}

function EditRolesDialog({ user, open, onOpenChange }: { user: UserListItem; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const initialRoleIds = user.roles.map((r) => r.id);
  const [allRoles, setAllRoles] = useState<RbacRole[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(initialRoleIds);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedRoleIds(user.roles.map((r) => r.id));
    getActiveRoles().then(setAllRoles);
  }, [open, user.id]);

  const isDirty =
    selectedRoleIds.length !== initialRoleIds.length ||
    selectedRoleIds.some((id) => !initialRoleIds.includes(id));

  function toggleRole(roleId: string) {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  }

  async function handleSave() {
    setIsPending(true);
    await setUserRoles(user.id, selectedRoleIds);
    setIsPending(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Roles</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-[#6C7E8E] break-all -mt-1">{user.email}</p>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {allRoles.length === 0 ? (
            <p className="text-sm text-[#6C7E8E]">No roles available.</p>
          ) : (
            allRoles.map((role) => (
              <label
                key={role.id}
                className="flex items-start gap-3 p-3 bg-[#F9FAFB] rounded-lg border border-[#E2E7EC] hover:border-[#5BC4E7] hover:bg-[#E2F4FA] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedRoleIds.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                  className="mt-0.5 w-4 h-4 rounded border-[#E2E7EC] text-[#5BC4E7] cursor-pointer"
                />
                <div className="flex-1">
                  <p className="font-medium text-sm text-[#1A1D20]">{role.name}</p>
                  {role.description && (
                    <p className="text-xs text-[#6C7E8E] mt-0.5">{role.description}</p>
                  )}
                </div>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            disabled={!isDirty || isPending}
            onClick={handleSave}
            className="bg-[#5BC4E7] text-white hover:bg-[#4AADE0]"
          >
            {isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving...</> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserDetailPane({ user, onClose }: { user: UserListItem; onClose: () => void }) {
  const [editRolesOpen, setEditRolesOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);

  return (
    <div className="flex flex-col w-72 shrink-0 border-l border-[#E2E7EC]">
      <CardHeader className="flex-row items-center justify-between space-y-0 py-4 border-b border-[#E2E7EC]">
        <CardTitle className="text-sm">User Details</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div>
          <p className="text-xs text-[#6C7E8E] font-medium uppercase tracking-wide mb-1">Email</p>
          <p className="text-sm text-[#1A1D20] break-all">{user.email}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#6C7E8E] font-medium uppercase tracking-wide">Roles</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditRolesOpen(true)}
              className="h-6 px-2 text-xs text-[#5BC4E7] hover:text-[#3AAFE0] hover:bg-[#E2F4FA]"
            >
              <Settings2 className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </div>
          <RoleBadges roles={user.roles} />
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[#6C7E8E] font-medium uppercase tracking-wide">Status</p>
          <Button
            size="sm"
            variant={user.isBanned ? 'outline' : 'destructive'}
            onClick={() => setToggleOpen(true)}
            className="w-full"
          >
            {user.isBanned ? 'Activate User' : 'Deactivate User'}
          </Button>
        </div>
      </CardContent>

      <EditRolesDialog user={user} open={editRolesOpen} onOpenChange={setEditRolesOpen} />
      <ToggleUserDialog user={user} open={toggleOpen} onOpenChange={setToggleOpen} />
    </div>
  );
}

export function UserManagementSection({ users }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);

  function handleRowClick(user: UserListItem) {
    setSelectedUser((prev) => (prev?.id === user.id ? null : user));
  }

  return (
    <>
      <Card className="flex flex-col flex-1 overflow-hidden">
        <CardHeader className="flex-row items-center justify-between space-y-0 shrink-0">
          <div>
            <CardTitle className="text-xl">User Management</CardTitle>
            <CardDescription className="mt-1">
              Create and manage system users with role-based access control
            </CardDescription>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#5BC4E7] text-white hover:bg-[#4AADE0] rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create User
          </Button>
        </CardHeader>

        <CardContent className="p-0 flex flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto min-w-0">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-[#F9FAFB] border-t border-[#E2E7EC]">
                  <TableHead className="text-[#6C7E8E] font-semibold">Email</TableHead>
                  <TableHead className="text-[#6C7E8E] font-semibold">Roles</TableHead>
                  <TableHead className="text-[#6C7E8E] font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-[#6C7E8E]">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      isSelected={selectedUser?.id === user.id}
                      onClick={() => handleRowClick(user)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {selectedUser && (
            <UserDetailPane user={selectedUser} onClose={() => setSelectedUser(null)} />
          )}
        </CardContent>
      </Card>

      <CreateUserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}