import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="w-full bg-[#F5F3EC] py-20 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl font-bold text-[#1A1D20] leading-tight">
                First Davao Millennium Property Ventures Inc.
              </h1>
              <p className="text-xl text-[#6C7E8E] leading-relaxed">
                Empowering property management through innovative digital solutions. Streamline operations, manage resources, and grow your business.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="/login">
                <Button className="bg-[#5BC4E7] text-white hover:bg-[#4AADE0] rounded-lg px-10 py-6 text-lg font-semibold">
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="#about">
                <Button
                  variant="outline"
                  className="border-2 border-[#5BC4E7] text-[#5BC4E7] hover:bg-[#E2F4FA] rounded-lg px-10 py-6 text-lg font-semibold"
                >
                  Learn More
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Side - Feature Cards */}
          <div className="grid gap-4">
            <div className="bg-white rounded-2xl p-6 border border-[#E2E7EC] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-[#E2F4FA] rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🏢</span>
                </div>
                <div>
                  <h3 className="font-semibold text-[#1A1D20]">Property Management</h3>
                  <p className="text-sm text-[#6C7E8E] mt-1">Efficiently manage all your properties in one place</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#E2E7EC] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-[#FFF9E5] rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <h3 className="font-semibold text-[#1A1D20]">User Management</h3>
                  <p className="text-sm text-[#6C7E8E] mt-1">Role-based access control for teams</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#E2E7EC] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-[#E2F4FA] rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">📊</span>
                </div>
                <div>
                  <h3 className="font-semibold text-[#1A1D20]">Analytics & Reporting</h3>
                  <p className="text-sm text-[#6C7E8E] mt-1">Detailed insights into your operations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
