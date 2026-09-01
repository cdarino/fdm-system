'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CreateUserModal } from './create-user-modal';

export function UserManagementSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#E2E7EC] p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-[#1A1D20]">User Management</h3>
            <p className="text-sm text-[#6C7E8E] mt-1">
              Create and manage system users with role-based access control
            </p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#5BC4E7] text-white hover:bg-[#4AADE0] rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create User
          </Button>
        </div>

        <div className="p-4 bg-[#F9FAFB] rounded-lg border border-[#E2E7EC]">
          <p className="text-sm text-[#6C7E8E]">
            ✓ Create new users with assigned roles<br/>\n            ✓ Manage user permissions and access levels<br/>\n            ✓ Control property and resource assignments
          </p>
        </div>
      </div>

      <CreateUserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
