import Link from 'next/link';
import { ArrowUpRight, LandPlot, Users, Settings, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export function QuickLinks({ canViewProperties, canViewClients, isSystemAdmin }: { canViewProperties: boolean; canViewClients: boolean; isSystemAdmin: boolean }) {
  const links = [
    { label: 'Client directory', detail: 'Profiles, documents & activity', href: '/dashboard/clients', icon: Users, visible: canViewClients },
    { label: 'Property map', detail: 'Locate lots & review assignments', href: '/dashboard/properties/map', icon: LandPlot, visible: canViewProperties },
    { label: 'User management', detail: 'Team members & access', href: '/dashboard/admin', icon: ShieldCheck, visible: isSystemAdmin },
    { label: 'Account settings', detail: 'Manage your password', href: '/dashboard/settings', icon: Settings, visible: true },
  ].filter(link => link.visible);
  return <Card><CardHeader><CardTitle>Your workspace</CardTitle><CardDescription>Go straight to the tools you need</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {links.map(({ icon: Icon, ...link }) => <Link key={link.href} href={link.href} className="group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="rounded-lg bg-sidebar-accent p-2 text-accent-blue-foreground"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{link.label}</p><p className="mt-1 text-xs text-muted-foreground">{link.detail}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>)}
  </CardContent></Card>;
}
