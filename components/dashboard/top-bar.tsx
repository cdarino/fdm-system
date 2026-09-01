'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout as signOut } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardTopBarProps {
  userName?: string;
}

export function DashboardTopBar({ userName = 'User names' }: DashboardTopBarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await signOut();
      router.replace('/');
      router.refresh();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Unable to log out.');
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="bg-white border-b border-[#E2E7EC] sticky top-0 z-40">
      <div className="h-16 px-8 flex items-center justify-end gap-6">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="text-[#6C7E8E] hover:bg-[#F5F3EC] hover:text-[#1A1D20] relative"
        >
          <Bell className="w-5 h-5" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center space-x-2 text-[#1A1D20] hover:bg-[#F5F3EC]"
            >
              <span className="text-sm font-medium">{userName}</span>
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                U
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <button
              type="button"
              className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-red-600 outline-none transition-colors hover:bg-accent focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={isLoggingOut}
              onClick={() => void handleLogout()}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
            {logoutError && (
              <p className="max-w-56 px-2 py-1 text-xs text-red-600">{logoutError}</p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
