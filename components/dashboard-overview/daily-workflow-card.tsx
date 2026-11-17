import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import { DASHBOARD_WORKFLOW } from '@/lib/dashboard-workflow';

interface DailyWorkflowCardProps {
  permissions: {
    canReadClients: boolean;
    canReadProperties: boolean;
    canReadBilling: boolean;
    canReadTitles: boolean;
  };
}

export function DailyWorkflowCard({ permissions }: DailyWorkflowCardProps) {
  // Filter workflow steps to only show workspaces the user can access
  const visibleSteps = DASHBOARD_WORKFLOW.filter((step) => {
    switch (step.permission) {
      case 'clients.read':
        return permissions.canReadClients;
      case 'properties.read':
        return permissions.canReadProperties;
      case 'billing.read':
        return permissions.canReadBilling;
      case 'legal.read':
        return permissions.canReadTitles;
      default:
        return false;
    }
  });

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Your daily workflow</CardTitle>
          <IconBox variant="canvas" size="default" aria-label="Daily workflow module">
            <Compass className="h-4 w-4" />
          </IconBox>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleSteps.map((link) => (
            <Link
              key={link.step}
              href={link.href}
              className="group flex flex-col justify-between gap-2.5 rounded-xl border border-border p-3.5 transition-colors hover:bg-row-hover hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-primary">
                <span>STEP {link.step}</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
              <div>
                <span className="block text-sm font-semibold tracking-tight text-foreground">
                  {link.title}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground line-clamp-2">
                  {link.description}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-4 border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{visibleSteps.length} of 4 workspaces accessible</span>
        </div>
      </CardContent>
    </Card>
  );
}
