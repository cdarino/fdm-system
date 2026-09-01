import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FdmLogo } from '@/components/fdm-logo';

export function Navbar() {
  return (
    <nav className="w-full bg-white border-b border-[#E2E7EC] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Branding */}
          <Link href="/" className="flex items-center space-x-3 group">
            <FdmLogo className="h-12 w-16 object-contain" />
            <div className="hidden sm:block">
              <h1 className="font-bold text-[#1A1D20] text-sm leading-tight">First Davao<br/>Millennium</h1>
            </div>
          </Link>

          {/* Auth Buttons */}
          <div className="flex items-center space-x-3">
            <Link href="/login">
              <Button className="bg-[#F5CE42] text-[#1A1D20] hover:bg-[#E5BD32] font-semibold">
                Log In
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
