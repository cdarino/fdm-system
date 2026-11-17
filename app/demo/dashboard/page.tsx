'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  FileCheck2,
  FileWarning,
  LandPlot,
  Phone,
  Receipt,
  Users,
  AlertTriangle,
  Clock,
  History,
  FileText,
  SlidersHorizontal,
  Compass,
  PieChart,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Briefcase,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/billing/ledger-engine';

// =============================================================================
// Realistic Fixture Data
// =============================================================================

const ROLES = [
  { id: 'system_admin', label: 'System Admin (All access)' },
  { id: 'billing_staff', label: 'Billing Staff (Billing, Clients, Properties · No Legal)' },
  { id: 'legal_staff', label: 'Legal Staff (Titles, Clients, Properties · No Billing)' },
  { id: 'admin_staff', label: 'Admin Staff (All access)' },
  { id: 'accounting_staff', label: 'Accounting Staff (Billing & Clients · No Legal or Properties)' },
] as const;

type RoleId = (typeof ROLES)[number]['id'];

function getRolePermissions(role: RoleId) {
  switch (role) {
    case 'system_admin':
    case 'admin_staff':
      return {
        canReadBilling: true,
        canReadTitles: true,
        canReadClients: true,
        canReadProperties: true,
      };
    case 'billing_staff':
      return {
        canReadBilling: true,
        canReadTitles: false,
        canReadClients: true,
        canReadProperties: true,
      };
    case 'legal_staff':
      return {
        canReadBilling: false,
        canReadTitles: true,
        canReadClients: true,
        canReadProperties: true,
      };
    case 'accounting_staff':
      return {
        canReadBilling: true,
        canReadTitles: false,
        canReadClients: true,
        canReadProperties: false,
      };
    default:
      return {
        canReadBilling: false,
        canReadTitles: false,
        canReadClients: false,
        canReadProperties: false,
      };
  }
}

const ROLE_FOCUS: Record<RoleId, { title: string; description: string }> = {
  system_admin: {
    title: 'Workspace Administrator',
    description:
      'Monitor overdue collections, track title releases through handover, review inventory, and maintain user permissions.',
  },
  billing_staff: {
    title: 'Billing & Ledgers Focus',
    description:
      'Follow up on accounts due soon, enforce demand notices for arrears, and clear fully settled buyers for legal title intake.',
  },
  legal_staff: {
    title: 'Title Pipeline Focus',
    description:
      'Intake billing-cleared files, prepare release packets, complete supervisor reviews, and chase unclaimed titles for physical handover.',
  },
  admin_staff: {
    title: 'Records & Traceability Focus',
    description:
      'Review incomplete client files, obtain valid government IDs, and update buyer contact channels so notices and titles arrive safely.',
  },
  accounting_staff: {
    title: 'Financial Review Focus',
    description:
      'Reconcile official receipts, monitor installments, and review billing ledgers for audit preparation.',
  },
};

const WORKFLOW_STEPS = [
  { step: '01', title: 'Client records', href: '/dashboard/clients', description: 'Verify identity and contacts, complete documents, then assign a lot.' },
  { step: '02', title: 'Property inventory', href: '/dashboard/properties/map', description: 'Locate the lot, check availability, and review client assignment.' },
  { step: '03', title: 'Billing & ledgers', href: '/dashboard/billing', description: 'Manage buyer installment accounts, receipts, penalties, and clearances.' },
  { step: '04', title: 'Title releases', href: '/dashboard/legal', description: 'Start with a billing-cleared account and follow the release stages.' },
];

const FIXTURE_BILLING_DUE_SOON = [
  { id: 'b-1', name: 'Santos, Eduardo P.', lot: 'Sunrise Valley · B2 L5', due: 'Nov 20, 2026', amount: 8500, daysLeft: '3 days left' },
  { id: 'b-2', name: 'Lim, Corazon T.', lot: 'Oceanview Heights · B1 L14', due: 'Nov 22, 2026', amount: 12000, daysLeft: '5 days left' },
  { id: 'b-3', name: 'Villanueva, Roberto S.', lot: 'Blue Ridge Phase 2 · B4 L9', due: 'Nov 25, 2026', amount: 9500, daysLeft: '8 days left' },
  { id: 'b-4', name: 'Mercado, Teresa M.', lot: 'Greenhills · B3 L2', due: 'Nov 28, 2026', amount: 14200, daysLeft: '11 days left' },
  { id: 'b-5', name: 'Tan, Ferdinand C.', lot: 'Mountain Breeze · B5 L11', due: 'Nov 30, 2026', amount: 11000, daysLeft: '13 days left' },
];

const FIXTURE_BILLING_OVERDUE = [
  { id: 'b-6', name: 'Alcantara, Rogelio V.', lot: 'Blue Ridge Phase 1 · B2 L8', overdueMonths: '4 mos overdue', amount: 48500, stage: 'Final Demand' },
  { id: 'b-7', name: 'Castillo, Danilo R.', lot: 'Sunrise Valley · B4 L12', overdueMonths: '2 mos overdue', amount: 24000, stage: '2nd Notice' },
  { id: 'b-8', name: 'Dela Cruz, Maria Elena', lot: 'Oceanview Heights · B3 L7', overdueMonths: '1 mo overdue', amount: 11500, stage: '1st Notice' },
  { id: 'b-9', name: 'Reyes, Antonio J.', lot: 'Greenhills · B1 L15', overdueMonths: '3 mos overdue', amount: 36200, stage: '2nd Notice' },
  { id: 'b-10', name: 'Navarro, Gloria S.', lot: 'Mountain Breeze · B2 L3', overdueMonths: '2 mos overdue', amount: 21800, stage: '1st Notice' },
];

interface TitleActionRecord {
  id: string;
  name: string;
  lot: string;
  state: string;
  statusTab: string;
  isAlert?: boolean;
}

const FIXTURE_DYNAMIC_TITLES: Record<
  'unclaimed' | 'intake' | 'prep' | 'review',
  {
    label: string;
    count: number;
    icon: LucideIcon;
    records: TitleActionRecord[];
  }
> = {
  unclaimed: {
    label: 'Ready for claim',
    count: 6,
    icon: Clock,
    records: [
      {
        id: 't-u1',
        name: 'Del Rosario, Carmen V.',
        lot: 'Blue Ridge Phase 2 · B3 L4',
        state: '1st notice returned to sender',
        statusTab: 'ready',
        isAlert: true,
      },
      {
        id: 't-u2',
        name: 'Villanueva, Clara S.',
        lot: 'Oceanview Heights · B1 L11',
        state: '2 mos overdue',
        statusTab: 'ready',
        isAlert: true,
      },
      {
        id: 't-u3',
        name: 'Enriquez, Danilo P.',
        lot: 'Greenhills · B2 L6',
        state: '1st notice received',
        statusTab: 'ready',
      },
      {
        id: 't-u4',
        name: 'Santos, Maria C.',
        lot: 'Sunrise Valley · B1 L8',
        state: '1st notice ongoing',
        statusTab: 'ready',
      },
      {
        id: 't-u5',
        name: 'Bautista, Elena P.',
        lot: 'Mountain Breeze · B4 L7',
        state: 'Original title in vault',
        statusTab: 'ready',
      },
    ],
  },
  intake: {
    label: 'Billing cleared',
    count: 8,
    icon: FileCheck2,
    records: [
      {
        id: 't-i1',
        name: 'Torres, Ramon G.',
        lot: 'Greenhills · B5 L2',
        state: 'Cleared 2 days ago',
        statusTab: 'intake',
      },
      {
        id: 't-i2',
        name: 'Mendoza, Beatriz C.',
        lot: 'Sunrise Valley · B1 L4',
        state: 'Cleared 3 days ago',
        statusTab: 'intake',
      },
      {
        id: 't-i3',
        name: 'Aquino, Manuel L.',
        lot: 'Blue Ridge Phase 2 · B3 L1',
        state: 'Cleared 7 days ago',
        statusTab: 'intake',
      },
      {
        id: 't-i4',
        name: 'Soriano, Clara D.',
        lot: 'Oceanview Heights · B2 L9',
        state: 'Cleared 8 days ago',
        statusTab: 'intake',
      },
      {
        id: 't-i5',
        name: 'Dela Vega, Consuelo T.',
        lot: 'Mountain Breeze · B2 L10',
        state: 'Cleared 9 days ago',
        statusTab: 'intake',
      },
    ],
  },
  prep: {
    label: 'Document preparation',
    count: 4,
    icon: FileText,
    records: [
      {
        id: 't-p1',
        name: 'Gomez, Patricia T.',
        lot: 'Sunrise Valley · B3 L11',
        state: '4 of 6 documents',
        statusTab: 'preparation',
      },
      {
        id: 't-p2',
        name: 'Navarro, Gloria S.',
        lot: 'Mountain Breeze · B1 L14',
        state: '5 of 6 documents',
        statusTab: 'preparation',
      },
      {
        id: 't-p3',
        name: 'Alvarez, Rosalina M.',
        lot: 'Blue Ridge Phase 1 · B1 L8',
        state: '5 of 6 documents',
        statusTab: 'preparation',
      },
      {
        id: 't-p4',
        name: 'Reyes, Antonio J.',
        lot: 'Greenhills · B1 L15',
        state: 'Packet complete (6/6)',
        statusTab: 'preparation',
      },
    ],
  },
  review: {
    label: 'Supervisor verification',
    count: 3,
    icon: CheckCircle2,
    records: [
      {
        id: 't-r1',
        name: 'Flores, Milagros B.',
        lot: 'Mountain Breeze · B1 L12',
        state: 'Packet complete (6/6)',
        statusTab: 'review',
      },
      {
        id: 't-r2',
        name: 'Lim, Rodrigo V.',
        lot: 'Oceanview Heights · B2 L15',
        state: 'Packet complete (6/6)',
        statusTab: 'review',
      },
      {
        id: 't-r3',
        name: 'Castillo, Danilo R.',
        lot: 'Sunrise Valley · B4 L12',
        state: 'Packet complete (6/6)',
        statusTab: 'review',
      },
    ],
  },
};

type QueueKey = keyof typeof FIXTURE_DYNAMIC_TITLES;

const FIXTURE_CLIENT_FOLLOWUPS = {
  documents: [
    { clientId: 'c-101', name: 'Alvarez, Rosalina M.', detail: 'Missing: Valid Government ID' },
    { clientId: 'c-102', name: 'Bautista, Fernando S.', detail: 'Missing: Contract to Sell' },
    { clientId: 'c-103', name: 'Castillo, Edgardo R.', detail: 'Missing: Marriage Certificate & Spouse TIN' },
    { clientId: 'c-104', name: 'Dela Vega, Consuelo T.', detail: 'Missing: TIN Verification' },
    { clientId: 'c-105', name: 'Enriquez, Danilo P.', detail: 'Missing: Valid Government ID' },
  ],
  contacts: [
    { clientId: 'c-201', name: 'Flores, Milagros B.', detail: 'No mobile or alternative contact on file' },
    { clientId: 'c-202', name: 'Gonzales, Rogelio C.', detail: 'City only; street and barangay missing' },
    { clientId: 'c-203', name: 'Hernandez, Corazon L.', detail: 'Disconnected mobile number recorded' },
    { clientId: 'c-204', name: 'Ilagan, Vicente K.', detail: 'No phone or provincial address recorded' },
  ],
};

const FIXTURE_ACTIVITY = [
  {
    id: 'act-1',
    label: 'Payment received · ₱15,000.00',
    detail: 'OR #10482 · Dela Cruz, Juan · Blue Ridge Phase 2 (B3 L12)',
    time: '12 mins ago',
    actor: 'Cashier Staff',
    href: '/dashboard/billing',
  },
  {
    id: 'act-2',
    label: 'Title advanced to Ready for Claim',
    detail: 'Santos, Maria C. · Sunrise Valley (B1 L8) · Clearance hold ended',
    time: '45 mins ago',
    actor: 'Legal In-Charge',
    href: '/dashboard/legal?status=ready',
  },
  {
    id: 'act-3',
    label: 'Account cleared by Billing',
    detail: 'Torres, Ramon G. · Greenhills (B5 L2) · Sent to Legal intake',
    time: '2 hours ago',
    actor: 'Billing Head',
    href: '/dashboard/legal?status=intake',
  },
  {
    id: 'act-4',
    label: 'Demand notice served · 2nd Notice',
    detail: 'Lim, Rodrigo V. · Oceanview (B2 L15) · Arrears ₱42,300.00',
    time: '3 hours ago',
    actor: 'Billing Staff',
    href: '/dashboard/billing?status=overdue',
  },
  {
    id: 'act-5',
    label: 'Client record updated',
    detail: 'Navarro, Teresa M. · Valid Government ID uploaded & verified',
    time: '4 hours ago',
    actor: 'Admin Staff',
    href: '/dashboard/clients',
  },
];

const FIXTURE_LOT_STATUSES = [
  { label: 'Open', count: 142 },
  { label: 'Reserved', count: 38 },
  { label: 'Sold', count: 485 },
  { label: 'Forfeited', count: 12 },
];

const LOT_COLORS = ['var(--success)', 'var(--primary)', 'var(--secondary)', 'var(--destructive)'];

// =============================================================================
// Clean Components
// =============================================================================

/** Your Daily Workflow - Dynamic Grid based on role permissions */
function DailyWorkflowCard({ permissions }: { permissions: { canReadBilling: boolean; canReadTitles: boolean; canReadClients: boolean; canReadProperties: boolean } }) {
  const visibleSteps = WORKFLOW_STEPS.filter((step) => {
    if (step.step === '01') return permissions.canReadClients;
    if (step.step === '02') return permissions.canReadProperties;
    if (step.step === '03') return permissions.canReadBilling;
    if (step.step === '04') return permissions.canReadTitles;
    return true;
  });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Your daily workflow</CardTitle>
          <IconBox variant="canvas" size="default" aria-label="Workflow navigation">
            <Compass className="h-4 w-4" />
          </IconBox>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div className={cn(
          "grid gap-3",
          visibleSteps.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"
        )}>
          {visibleSteps.map((link) => (
            <Link
              key={link.href}
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

/** Universal Recent Activity Feed */
function UniversalActivityCard() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Recent changes</CardTitle>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live feed
            </span>
            <IconBox variant="canvas" size="default" aria-label="Workspace activity feed">
              <History className="h-4 w-4" />
            </IconBox>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <ol className="divide-y divide-border">
          {FIXTURE_ACTIVITY.map((item) => (
            <li key={item.id} className="py-2.5 first:pt-0">
              <Link
                href={item.href}
                className="group block rounded-md p-1 transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center justify-between gap-3 text-sm font-medium">
                  <span className="truncate group-hover:text-primary">{item.label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                </div>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground truncate">
                  {item.detail}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {item.time} &bull; {item.actor}
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <div className="mt-4 border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live workspace feed
          </span>
          <Link href="/dashboard/reports" className="font-medium text-primary hover:underline">
            View Audit Log &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/** Card: Billing Actionable Accounts */
function BillingActionCard({ isFullWidth }: { isFullWidth?: boolean }) {
  const [view, setView] = useState<'due_soon' | 'overdue'>('due_soon');
  const items = view === 'due_soon' ? FIXTURE_BILLING_DUE_SOON : FIXTURE_BILLING_OVERDUE;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Billing accounts needing attention</CardTitle>
          <IconBox variant="canvas" size="default" aria-label="Billing module">
            <Receipt className="h-4 w-4" />
          </IconBox>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div>
          <div
            className={cn(
              "grid gap-3",
              isFullWidth ? "grid-cols-2 max-w-md" : "grid-cols-2"
            )}
            role="group"
            aria-label="Choose billing category"
          >
            <button
              type="button"
              onClick={() => setView('due_soon')}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === 'due_soon' ? 'border-primary bg-sidebar-accent' : 'bg-background'
              )}
            >
              <Clock aria-hidden="true" className="mb-2 h-4 w-4 text-primary" />
              <span className="block text-2xl font-semibold tabular-nums">5</span>
              <span className="text-xs text-muted-foreground">Due soon (within 15 days)</span>
            </button>

            <button
              type="button"
              onClick={() => setView('overdue')}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === 'overdue' ? 'border-primary bg-sidebar-accent' : 'bg-background'
              )}
            >
              <AlertTriangle aria-hidden="true" className="mb-2 h-4 w-4 text-amber-600 dark:text-amber-500" />
              <span className="block text-2xl font-semibold tabular-nums">14</span>
              <span className="text-xs text-muted-foreground">In arrears / Overdue</span>
            </button>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">
              {view === 'due_soon'
                ? 'Showing 5 upcoming maturities · chronological order'
                : 'Showing 5 urgent overdue accounts · priority order'}
            </p>

            <ul className={cn(
              isFullWidth
                ? "grid grid-cols-1 md:grid-cols-2 gap-3"
                : "divide-y divide-border"
            )}>
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    isFullWidth
                      ? "rounded-lg border border-border/70 p-3 hover:bg-muted/50 transition-colors"
                      : "py-3 hover:bg-muted rounded-md"
                  )}
                >
                  <Link
                    href={`/dashboard/billing`}
                    className="flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium text-foreground">
                        {item.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.lot} &bull;{' '}
                        {'daysLeft' in item ? (
                          <span className="text-foreground font-medium">Due {item.due} ({item.daysLeft})</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-500 font-medium">
                            {item.overdueMonths} ({item.stage})
                          </span>
                        )}
                      </span>
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold tabular-nums text-foreground">
                        {formatCurrency(item.amount)}
                      </span>
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Active accounts monitored daily.</span>
          <Link href="/dashboard/billing" className="font-medium text-primary hover:underline">
            Open Billing Ledgers &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/** Card: Title Records Needing Action - Dynamic Queue Filter Chips */
function DynamicTitleActionCard({ isFullWidth }: { isFullWidth?: boolean }) {
  const activeQueues = (Object.keys(FIXTURE_DYNAMIC_TITLES) as QueueKey[])
    .filter((k) => FIXTURE_DYNAMIC_TITLES[k].count > 0)
    .map((k) => ({ key: k, ...FIXTURE_DYNAMIC_TITLES[k] }));

  const [activeQueueKey, setActiveQueueKey] = useState<QueueKey>(
    () => activeQueues[0]?.key ?? 'unclaimed'
  );

  const currentQueue = FIXTURE_DYNAMIC_TITLES[activeQueueKey] ?? activeQueues[0];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Title records needing action</CardTitle>
          <IconBox variant="canvas" size="default" aria-label="Legal & Titling module">
            <FileCheck2 className="h-4 w-4" />
          </IconBox>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div>
          {/* Queue Buttons: 4 columns when full-width, 2 columns when half-width */}
          <div
            className={cn(
              "grid gap-2 w-full",
              isFullWidth ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"
            )}
            role="group"
            aria-label="Active title queues"
          >
            {activeQueues.map((q) => {
              const Icon = q.icon;
              const isSelected = activeQueueKey === q.key;
              return (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => setActiveQueueKey(q.key)}
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-2 text-xs transition-colors w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected
                      ? 'border-primary bg-sidebar-accent font-semibold text-foreground shadow-2xs'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="truncate">{q.label}</span>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-bold shrink-0',
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {q.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">
              Showing {currentQueue?.records.length ?? 0} records in <strong className="text-foreground">{currentQueue?.label}</strong>
            </p>

            <ul className={cn(
              isFullWidth
                ? "grid grid-cols-1 md:grid-cols-2 gap-3"
                : "divide-y divide-border"
            )}>
              {currentQueue?.records.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    isFullWidth
                      ? "rounded-lg border border-border/70 p-3 hover:bg-muted/50 transition-colors"
                      : "py-3 hover:bg-muted rounded-md"
                  )}
                >
                  <Link
                    href={`/dashboard/legal?status=${item.statusTab}`}
                    className="flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium text-foreground">
                        {item.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.lot}
                      </span>
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          item.isAlert ? "text-destructive font-semibold" : "text-muted-foreground"
                        )}
                      >
                        {item.state}
                      </span>
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>128 titles successfully released to date.</span>
          <Link href={`/dashboard/legal?status=${currentQueue?.records[0]?.statusTab ?? 'ready'}`} className="font-medium text-primary hover:underline">
            Open in Legal Workspace &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/** Card: Records Needing Attention (Client Files) - Left Column */
function ClientFollowUpsCard({ isFullWidth }: { isFullWidth?: boolean }) {
  const [view, setView] = useState<'documents' | 'contacts'>('documents');
  const items = view === 'documents' ? FIXTURE_CLIENT_FOLLOWUPS.documents : FIXTURE_CLIENT_FOLLOWUPS.contacts;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Records needing attention</CardTitle>
          <IconBox variant="canvas" size="default" aria-label="Client records module">
            <Users className="h-4 w-4" />
          </IconBox>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div>
          <div
            className={cn(
              "grid gap-3",
              isFullWidth ? "grid-cols-2 max-w-md" : "grid-cols-2"
            )}
            role="group"
            aria-label="Choose record issue"
          >
            <button
              type="button"
              onClick={() => setView('documents')}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === 'documents' ? 'border-primary bg-sidebar-accent' : 'bg-background'
              )}
            >
              <FileWarning aria-hidden="true" className="mb-2 h-4 w-4" />
              <span className="block text-2xl font-semibold tabular-nums">18</span>
              <span className="text-xs text-muted-foreground">Missing documents</span>
            </button>

            <button
              type="button"
              onClick={() => setView('contacts')}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === 'contacts' ? 'border-primary bg-sidebar-accent' : 'bg-background'
              )}
            >
              <Phone aria-hidden="true" className="mb-2 h-4 w-4" />
              <span className="block text-2xl font-semibold tabular-nums">7</span>
              <span className="text-xs text-muted-foreground">No contact recorded</span>
            </button>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">
              Showing {items.length} clients &bull; alphabetical order
            </p>

            <ul className={cn(
              isFullWidth
                ? "grid grid-cols-1 md:grid-cols-2 gap-3"
                : "divide-y divide-border"
            )}>
              {items.map((item) => (
                <li
                  key={item.clientId}
                  className={cn(
                    isFullWidth
                      ? "rounded-lg border border-border/70 p-3 hover:bg-muted/50 transition-colors"
                      : "py-3 hover:bg-muted rounded-md"
                  )}
                >
                  <Link
                    href={`/dashboard/clients?client=${item.clientId}`}
                    className="flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium text-foreground">
                        {item.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    </span>
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Required: Valid ID &bull; street/brgy address</span>
          <Link href="/dashboard/clients" className="font-medium text-primary hover:underline">
            Open Directory &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Property Portfolio: Unified Single Card (Both Map & Chart Visible)
// =============================================================================

/** Right Column: Single Unified Card containing BOTH Subdivision Plat Map and Full SVG Donut Chart */
function PropertyPortfolioCard({ isFullWidth }: { isFullWidth?: boolean }) {
  const total = FIXTURE_LOT_STATUSES.reduce((sum, s) => sum + s.count, 0);
  let offset = 0;

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Property portfolio</CardTitle>
          <IconBox variant="canvas" size="default" aria-label="Property portfolio module">
            <LandPlot className="h-4 w-4" />
          </IconBox>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div className={cn(isFullWidth ? "grid grid-cols-1 lg:grid-cols-2 gap-8 items-start" : "space-y-6")}>
          {/* 1. Subdivision Plat Map Preview Block */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">
                Subdivision Plat Map &bull; Blue Ridge Heights Phase 1
              </span>
              <Link
                href="/dashboard/properties/map"
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                Open full map <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className={cn(
              "relative w-full rounded-lg border border-border bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center overflow-hidden",
              isFullWidth ? "h-64" : "h-52"
            )}>
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:14px_14px]" />
              <div className="relative text-center p-4">
                <LandPlot className="h-6 w-6 text-primary mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-foreground">34 lots demarcated</p>
                <p className="text-xs text-muted-foreground mt-1">28 sold &bull; 6 open</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">IGACOS, Samal Island &bull; Approved geodetic plan</p>
              </div>
            </div>
          </div>

          {/* 2. Lot Inventory Breakdown Block */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-foreground">
                Lot Inventory Breakdown &bull; {total} total lots recorded
              </span>
              <span className="text-xs text-muted-foreground">Active inventory status</span>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-6">
              {/* Full SVG Donut Chart */}
              <div className="relative h-44 w-44 shrink-0 mx-auto sm:mx-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
                  <circle cx="60" cy="60" r="46" fill="none" stroke="var(--muted)" strokeWidth="16" />
                  {FIXTURE_LOT_STATUSES.map((item, i) => {
                    const fraction = total ? ((item.count ?? 0) / total) * 100 : 0;
                    const start = offset;
                    offset += fraction;
                    return (
                      <circle
                        key={item.label}
                        cx="60"
                        cy="60"
                        r="46"
                        pathLength="100"
                        fill="none"
                        stroke={LOT_COLORS[i]}
                        strokeWidth="16"
                        strokeDasharray={`${fraction} ${100 - fraction}`}
                        strokeDashoffset={-start}
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums text-foreground">{total}</span>
                  <span className="text-xs text-muted-foreground">total lots</span>
                </div>
              </div>

              {/* Status Breakdown Legend - Clean, Borderless List Rows */}
              <div className="flex-1 w-full space-y-2">
                {FIXTURE_LOT_STATUSES.map((item, i) => (
                  <Link
                    key={item.label}
                    href={`/dashboard/properties?status=${encodeURIComponent(item.label)}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2.5 py-2.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: LOT_COLORS[i] }} />
                      <span className="font-medium text-foreground truncate">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold tabular-nums text-foreground">{item.count}</span>
                      <span className="text-muted-foreground tabular-nums text-xs w-9 text-right">
                        {Math.round((item.count / total) * 100)}%
                      </span>
                      <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>ArcGIS &bull; Vector polygons &bull; Active inventory</span>
          <Link href="/dashboard/properties" className="font-medium text-primary hover:underline flex items-center gap-1">
            Open Properties Directory &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Demo Page
// =============================================================================

export default function DashboardDemoPage() {
  const [activeRole, setActiveRole] = useState<RoleId>('system_admin');
  const [overridePerms, setOverridePerms] = useState<Partial<{
    canReadBilling: boolean;
    canReadTitles: boolean;
    canReadClients: boolean;
    canReadProperties: boolean;
  }>>({});

  const rolePerms = getRolePermissions(activeRole);
  const permissions = {
    canReadBilling: overridePerms.canReadBilling ?? rolePerms.canReadBilling,
    canReadTitles: overridePerms.canReadTitles ?? rolePerms.canReadTitles,
    canReadClients: overridePerms.canReadClients ?? rolePerms.canReadClients,
    canReadProperties: overridePerms.canReadProperties ?? rolePerms.canReadProperties,
  };

  const handleRoleChange = (role: RoleId) => {
    setActiveRole(role);
    setOverridePerms({});
  };

  const togglePerm = (key: keyof typeof permissions) => {
    setOverridePerms((prev) => ({
      ...prev,
      [key]: !permissions[key],
    }));
  };

  const hasWindDown = permissions.canReadBilling || permissions.canReadTitles;
  const isWindDownFull = permissions.canReadBilling !== permissions.canReadTitles;

  const hasRecordsAndPortfolio = permissions.canReadClients || permissions.canReadProperties;
  const isRow3Full = permissions.canReadClients !== permissions.canReadProperties;

  const formattedDate = new Date().toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });

  return (
    <PageContainer scrollable={true} padding={true}>
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
        {/* Lab Controls */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  ✓
                </span>
                <h1 className="text-sm font-bold text-foreground">Dashboard Modernization Preview</h1>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Role-based card gating &bull; Auto-expands to full-width with 2-column lists when single
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground mr-1">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Simulate Role:</span>
              </div>
              <select
                aria-label="Simulate User Role"
                value={activeRole}
                onChange={(e) => handleRoleChange(e.target.value as RoleId)}
                className="rounded border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary mr-1"
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => togglePerm('canReadBilling')}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                    permissions.canReadBilling
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted text-muted-foreground border-transparent line-through"
                  )}
                  title="Toggle Billing Permission"
                >
                  Billing: {permissions.canReadBilling ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => togglePerm('canReadTitles')}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                    permissions.canReadTitles
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted text-muted-foreground border-transparent line-through"
                  )}
                  title="Toggle Titles Permission"
                >
                  Titles: {permissions.canReadTitles ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => togglePerm('canReadClients')}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                    permissions.canReadClients
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted text-muted-foreground border-transparent line-through"
                  )}
                  title="Toggle Clients Permission"
                >
                  Clients: {permissions.canReadClients ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => togglePerm('canReadProperties')}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                    permissions.canReadProperties
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted text-muted-foreground border-transparent line-through"
                  )}
                  title="Toggle Properties Permission"
                >
                  Properties: {permissions.canReadProperties ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 border-t border-border/60 pt-2.5 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong className="text-foreground">Dynamic Role Adaptability:</strong> When a user lacks permission for one module in a section, that card is hidden and the remaining card expands to full-width, automatically converting its internal list into a comfortable 2-column grid!
            </span>
            <Link href="/demo" className="text-primary hover:underline flex items-center gap-1">
              &larr; Back to Demo Index
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DASHBOARD LAYOUT */}
        {/* ========================================================================= */}
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                FDM workspace
              </p>
              <h1 className="mt-1 text-2xl font-bold text-foreground">Dashboard</h1>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              {formattedDate}
            </p>
          </div>

          {/* Role-Aware Welcome Banner */}
          <Card className="flex flex-col gap-4 border-l-4 border-l-primary p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Welcome back, Kelly</p>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  &bull; <ShieldCheck className="h-3.5 w-3.5 text-primary inline" />
                  <span>{ROLE_FOCUS[activeRole].title}</span>
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {ROLE_FOCUS[activeRole].description}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {permissions.canReadBilling && (
                <Button asChild size="sm" variant="default">
                  <Link href="/dashboard/billing">
                    <Receipt className="h-4 w-4 mr-1.5" />
                    Record Payment
                  </Link>
                </Button>
              )}
              {permissions.canReadTitles && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/legal">
                    <FileCheck2 className="h-4 w-4 mr-1.5" />
                    Process Titles
                  </Link>
                </Button>
              )}
            </div>
          </Card>

          {/* ROW 1: WORKSPACE NAVIGATION + LIVE ACTIVITY */}
          <section aria-label="Workflow & Activity Hub" className="space-y-3">
            <div className="grid items-stretch gap-6 lg:grid-cols-2">
              <DailyWorkflowCard permissions={permissions} />
              <UniversalActivityCard />
            </div>
          </section>

          {/* ROW 2: WIND-DOWN OPERATIONS (Billing & Titles) */}
          {hasWindDown && (
            <section aria-labelledby="wind-down-heading" className="space-y-3">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                <Briefcase className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                <h2 id="wind-down-heading" className="text-base font-semibold tracking-tight text-foreground">
                  Wind-Down Operations
                </h2>
              </div>

              <div className={cn(
                "grid items-stretch gap-6",
                isWindDownFull ? "grid-cols-1" : "lg:grid-cols-2"
              )}>
                {permissions.canReadBilling && <BillingActionCard isFullWidth={isWindDownFull} />}
                {permissions.canReadTitles && <DynamicTitleActionCard isFullWidth={isWindDownFull} />}
              </div>
            </section>
          )}

          {/* ROW 3: CLIENT RECORDS & PROPERTY PORTFOLIO */}
          {hasRecordsAndPortfolio && (
            <section aria-labelledby="records-properties-heading" className="space-y-3">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                <Layers className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                <h2 id="records-properties-heading" className="text-base font-semibold tracking-tight text-foreground">
                  Records &amp; Property Portfolio
                </h2>
              </div>

              <div className={cn(
                "grid items-stretch gap-6",
                isRow3Full ? "grid-cols-1" : "lg:grid-cols-2"
              )}>
                {permissions.canReadClients && <ClientFollowUpsCard isFullWidth={isRow3Full} />}
                {permissions.canReadProperties && <PropertyPortfolioCard isFullWidth={isRow3Full} />}
              </div>
            </section>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
