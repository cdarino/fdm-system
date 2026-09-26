import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

const heroCards = [
  {
    // Same glyph as the Property Lots tile on the dashboard overview.
    icon: '🗺️',
    bg: 'bg-chart-3',
    title: 'Property Management',
    description: 'Efficiently manage all your properties in one place',
  },
  {
    icon: '👥',
    bg: 'bg-chart-4',
    title: 'User Management',
    description: 'Role-based access control for teams',
  },
  {
    icon: '📊',
    bg: 'bg-chart-3',
    title: 'Analytics & Reporting',
    description: 'Detailed insights into your operations',
  },
];

export function Hero() {
  return (
    <section className="w-full bg-background py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-16 md:grid-cols-2">

          <div className="space-y-8">

            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight text-foreground sm:text-6xl">
                First Davao Millennium Property Ventures Inc.
              </h1>
              <p className="text-xl leading-relaxed text-muted-foreground">
                Empowering property management through innovative digital solutions. Streamline operations, manage resources, and grow your business.
              </p>
            </div>

            <div className="flex flex-col gap-4 pt-4 sm:flex-row">
              <Button
                asChild
                className="h-auto rounded-lg bg-primary px-10 py-6 text-lg font-semibold text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
              >
                <Link href="/login">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>

          </div>

          <_HeroCards/>

        </div>
      </div>
    </section>
  );
}

function _HeroCards() {
    return (
        <div className="grid gap-4">
            {heroCards.map((card) => (
              <Card
                key={card.title}
                variant="interactive"
                padding="default"
                className="rounded-2xl shadow-sm"
              >
                <div className="flex items-start space-x-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${card.bg}`}>
                    <span className="text-2xl">{card.icon}</span>
                  </div>
                  <div>
                    <CardTitle size="sm">
                      {card.title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {card.description}
                    </CardDescription>
                  </div>
                </div>
              </Card>
            ))}
          </div>
    )
}
