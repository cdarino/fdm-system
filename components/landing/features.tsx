import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Home, Briefcase, Target } from 'lucide-react';

const features = [
  {
    icon: Home,
    title: 'Conflict Features',
    description: 'Handle overlapping client claims and conflicting records with built-in conflict detection.',
  },
  {
    icon: Briefcase,
    title: 'Business Features',
    description: 'Streamline core operations with tools for client management, installment tracking, and statement of account generation.',
  },
  {
    icon: Target,
    title: 'Complete Solution',
    description: 'Manage the entire property lifecycle, from acquisition and contract signing to BIR submission, Registry of Deeds processing, and title release.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="w-full bg-card py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="rounded-xl border-border bg-card p-6 shadow-none transition-shadow hover:shadow-md"
              >
                <CardHeader className="p-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sidebar-accent">
                    <Icon className="h-6 w-6 text-accent-blue-foreground" />
                  </div>
                  <CardTitle className="pt-4 text-base font-semibold text-foreground">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 pt-2">
                  <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

