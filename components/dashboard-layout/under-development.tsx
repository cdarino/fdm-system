import { Clock3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function UnderDevelopment({ feature }: { feature: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-chart-4">
            <Clock3 className="h-6 w-6 text-accent-gold-foreground" />
          </div>
          <CardTitle className="mt-3">Under development</CardTitle>
          <CardDescription>{feature} is being prepared for FDM’s workflow and is not available yet.</CardDescription>
        </CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">The current client, property, and account records remain available as usual.</p></CardContent>
      </Card>
    </div>
  );
}
