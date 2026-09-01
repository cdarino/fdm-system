'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { X, Loader2 } from 'lucide-react';
import { registerUser } from '@/lib/actions/admin-register';
import { getActiveRoles } from '@/lib/actions/admin-register';

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateUserModal({ isOpen, onClose }: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRoles();
    }
  }, [isOpen]);

  const loadRoles = async () => {
    try {
      const activeRoles = await getActiveRoles();
      setRoles(activeRoles || []);
    } catch (err) {
      console.error('Error loading roles:', err);
      setError('Failed to load roles');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsLoading(true);

    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Register the user with selected roles
      const result = await registerUser({
        email,
        password,
        roleIds: selectedRoles.length > 0 ? selectedRoles : undefined,
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to create user');
      }

      setSuccess(true);
      setEmail('');
      setPassword('');
      setSelectedRoles([]);

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-white border-[#E2E7EC] rounded-2xl shadow-lg">
        <div className="p-6 border-b border-[#E2E7EC] flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#1A1D20]">Create New User</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#F9FAFB] rounded-lg transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-[#6C7E8E]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Success Message */}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">User created successfully!</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#1A1D20] font-medium text-sm">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              disabled={isLoading || success}
              className="bg-[#F9FAFB] border-[#E2E7EC] text-[#1A1D20] placeholder:text-[#A0A8B0] focus:border-[#5BC4E7] focus:ring-[#5BC4E7] rounded-lg"
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#1A1D20] font-medium text-sm">
              Temporary Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading || success}
              className="bg-[#F9FAFB] border-[#E2E7EC] text-[#1A1D20] placeholder:text-[#A0A8B0] focus:border-[#5BC4E7] focus:ring-[#5BC4E7] rounded-lg"
            />
            <p className="text-xs text-[#6C7E8E] mt-1">
              User can change this after first login
            </p>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <Label className="text-[#1A1D20] font-medium text-sm">
              Assign Roles
            </Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {roles.length > 0 ? (
                roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-start gap-3 p-3 bg-[#F9FAFB] rounded-lg border border-[#E2E7EC] hover:border-[#5BC4E7] hover:bg-[#E2F4FA] cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoles([...selectedRoles, role.id]);
                        } else {
                          setSelectedRoles(selectedRoles.filter((id) => id !== role.id));
                        }
                      }}
                      disabled={isLoading || success}
                      className="mt-1 w-4 h-4 rounded border-[#E2E7EC] text-[#5BC4E7] cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm text-[#1A1D20]">{role.name}</p>
                      {role.description && (
                        <p className="text-xs text-[#6C7E8E] mt-1">{role.description}</p>
                      )}
                    </div>
                  </label>
                ))
              ) : (
                <p className="text-sm text-[#6C7E8E]">No roles available</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading || success}
              className="flex-1 border-[#E2E7EC] text-[#1A1D20] hover:bg-[#F9FAFB] rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || success}
              className="flex-1 bg-[#5BC4E7] text-white hover:bg-[#4AADE0] rounded-lg flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : success ? (
                'Created!'
              ) : (
                'Create User'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
