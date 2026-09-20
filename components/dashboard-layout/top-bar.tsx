'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout as signOut } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@supabase/supabase-js';
import { ComingSoonModal } from './coming-soon-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardTopBarProps {
  user?: AuthUser | null;
}

export function useTopBar() {
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

  return { isLoggingOut, logoutError, handleLogout };
}

export function DashboardTopBar({ user }: DashboardTopBarProps) {
  const { isLoggingOut, logoutError, handleLogout } = useTopBar();
  const displayName = [user?.user_metadata.first_name, user?.user_metadata.last_name]
    .filter(Boolean)
    .join(' ') || user?.email || 'Unknown';
  const avatarInitial = displayName[0]?.toUpperCase() ?? '?';
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
  }>({
    isOpen: false,
    title: 'Coming Soon!'
  });

  const handleComingSoon = (title: string) => {
    setModalState({ isOpen: true, title });
  };

  return (
    <>
      <div className="bg-card border-b border-border sticky top-0 z-40">
        <div className="h-16 px-8 flex items-center justify-end gap-6">
          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-background hover:text-foreground relative"
            onClick={() => handleComingSoon('Notifications')}
          >
            <Bell className="w-5 h-5" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center space-x-2 text-foreground hover:bg-background hover:text-foreground"
              >
                <span className="text-sm font-medium">{displayName}</span>
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {avatarInitial}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* One destination, one entry. Profile details and password live
                  on the same page, so two items pointing at it was redundant. */}
              {/* Overridden locally so the whole header highlights like the
                  sidebar; the shared DropdownMenuItem default is still accent. */}
              <DropdownMenuItem asChild className="focus:bg-background focus:text-foreground">
                <Link href="/dashboard/settings">Account Settings</Link>
              </DropdownMenuItem>
              <button
                type="button"
                className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-destructive outline-none transition-colors hover:bg-background focus:bg-background disabled:pointer-events-none disabled:opacity-50"
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
              {logoutError && (
                <p className="max-w-56 px-2 py-1 text-xs text-destructive">{logoutError}</p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ComingSoonModal 
        isOpen={modalState.isOpen} 
        onClose={() => setModalState({ ...modalState, isOpen: false })} 
        title={modalState.title}
      />
    </>
  );
}
