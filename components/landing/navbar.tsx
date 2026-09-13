import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FdmLogo } from '@/components/fdm-logo';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
            
            {/* Logo and title at the left */}
          <Link href="/" className="group flex items-center space-x-3">
            <FdmLogo className="h-12 w-16 object-contain" />
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold leading-tight text-foreground">
                First Davao<br />Millennium
              </h1>
            </div>
          </Link>

            {/* Log in button at the right */}
          <nav className="flex items-center space-x-3">
            <Button
              asChild
              variant="secondary"
              className="font-semibold hover:bg-[color-mix(in_srgb,var(--secondary)_85%,black)]"
            >
              <Link href="/login">Log In</Link>
            </Button>
          </nav>

        </div>
      </div>
    </header>
  );
}

