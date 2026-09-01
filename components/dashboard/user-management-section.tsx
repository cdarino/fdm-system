'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreateUserModal } from './create-user-modal';
import type { UserListItem } from '@/lib/actions/admin-register';

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

function UserRow({ user }: { user: UserListItem }) {
  return (
    <TableRow key={user.id}>
      <TableCell className="font-medium text-[#1A1D20]">{user.email}</TableCell>
      <TableCell><RoleBadges roles={user.roles} /></TableCell>
      <TableCell>
        {user.isBanned ? (
          <Badge variant="destructive" className="border-transparent">Banned</Badge>
        ) : (
          <Badge className="bg-green-100 text-green-700 border-transparent hover:bg-green-100">Active</Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

export function UserManagementSection({ users }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
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

        <CardContent className="p-0">
          <Table>
            <TableHeader>
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
                users.map((user) => <UserRow key={user.id} user={user} />)
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateUserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
