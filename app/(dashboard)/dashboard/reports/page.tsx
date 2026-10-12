import Link from 'next/link';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { hasPermission } from '@/lib/permissions';

export default async function ReportsPage() {
  const [clients, properties, titles] = await Promise.all([
    hasPermission('clients.read'), hasPermission('properties.read'), hasPermission('legal.read'),
  ]);
  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a record and use its PDF export action. Review title progress in the release workspace.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {clients && <ReportCard
            title="Client record reports"
            description="Portfolio, documents, interactions, and active property records."
            href="/dashboard/clients"
            action="Open clients"
          />}
          {titles && <ReportCard
            title="Title release overview"
            description="Review the release stages, document requirements, and clearance dates."
            href="/dashboard/legal"
            action="Open title queue"
          />}
          {properties && <ReportCard
            title="Property record reports"
            description="Find a lot and choose Export PDF from its actions menu."
            href="/dashboard/properties"
            action="Open property records"
          />}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How to export a record</CardTitle>
            <CardDescription>
              Client and property reports use the information saved in each record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Find the client or lot, open its actions menu, then choose Export PDF. Complete any missing information before sharing the report.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function ReportCard({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={href} className="text-sm font-medium text-primary hover:underline">
          {action}
        </Link>
      </CardContent>
    </Card>
  );
}
