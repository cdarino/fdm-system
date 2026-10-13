import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DASHBOARD_WORKFLOW } from '@/lib/dashboard-workflow';

export function QuickLinks({ canViewProperties, canViewClients, canViewTitles = false }: {
  canViewProperties: boolean; canViewClients: boolean; canViewTitles?: boolean;
}) {
  const visible = [canViewClients, canViewProperties, canViewTitles];
  const links = DASHBOARD_WORKFLOW.filter((_, index) => visible[index]);
  if (!links.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Your daily workflow
        </CardTitle>
        <CardDescription>Open a workspace to continue.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex flex-col justify-between gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-row-hover hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center justify-between text-xs font-semibold text-primary">
              <span>STEP {link.step}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
            <div>
              <span className="block text-sm font-semibold tracking-tight text-foreground">
                {link.title}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {link.description}
              </span>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
