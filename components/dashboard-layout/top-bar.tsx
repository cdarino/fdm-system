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
        <div className="flex h-16 min-w-0 items-center justify-end gap-3 px-4 sm:gap-6 sm:px-8">
          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-background hover:text-foreground relative"
            onClick={() => handleComingSoon('Notifications')}
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex min-w-0 items-center space-x-2 text-foreground hover:bg-background hover:text-foreground"
              >
                <span className="hidden max-w-40 min-w-0 truncate text-sm font-medium sm:block">{displayName}</span>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-400 text-sm font-semibold text-white">
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
              <DropdownMenuItem asChild>
                <button
                  type="button"
                  className="relative flex w-full cursor-pointer items-center gap-2 text-left text-sm text-destructive focus:text-destructive"
                  disabled={isLoggingOut}
                  onClick={() => void handleLogout()}
                >
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </DropdownMenuItem>
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
