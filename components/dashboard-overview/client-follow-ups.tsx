'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, FileWarning, Phone, CheckCircle2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DOC_TYPE_LABEL } from '@/lib/types/client';
import type { ClientFollowUp } from '@/lib/client-record-review';

export function ClientFollowUps({
  items,
  isFullWidth,
}: {
  items: ClientFollowUp[] | null;
  isFullWidth?: boolean;
}) {
  const [view, setView] = useState<'documents' | 'contacts'>('documents');
  const [limit, setLimit] = useState(5);
  const documents = items?.filter((item) => item.missingDocuments.length) ?? [];
  const contacts = items?.filter((item) => item.missingContact) ?? [];
  const current = view === 'documents' ? documents : contacts;

  return (
    <Card className="h-full flex flex-col justify-between" id="client-follow-ups">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Records needing attention</CardTitle>
          <IconBox variant="canvas" size="default" aria-label="Client records module">
            <Users className="h-4 w-4" />
          </IconBox>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
        {items === null ? (
          <p className="py-8 text-sm text-muted-foreground">
            Record checks are temporarily unavailable. You can still review profiles in the client directory.
          </p>
        ) : (
          <div>
            <div
              className={cn(
                'grid gap-3',
                isFullWidth ? 'grid-cols-2 max-w-md' : 'grid-cols-2'
              )}
              role="group"
              aria-label="Choose record issue"
            >
              {([
                { key: 'documents', title: 'Missing documents', count: documents.length, icon: FileWarning },
                { key: 'contacts', title: 'No contact recorded', count: contacts.length, icon: Phone },
              ] as const).map(({ key, title, count, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  aria-controls="client-follow-up-results"
                  onClick={() => {
                    setView(key);
                    setLimit(5);
                  }}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    view === key ? 'border-primary bg-sidebar-accent' : 'bg-background'
                  )}
                >
                  <Icon aria-hidden="true" className="mb-2 h-4 w-4" />
                  <span className="block text-2xl font-semibold tabular-nums">{count.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">{title}</span>
                </button>
              ))}
            </div>

            <div id="client-follow-up-results" className="mt-4" aria-live="polite">
              {current.length === 0 ? (
                <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  {view === 'documents'
                    ? 'No missing required documents found.'
                    : 'All current clients have a contact value recorded.'}
                </p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Showing {Math.min(limit, current.length)} of {current.length} clients &bull; alphabetical order
                  </p>
                  <ul
                    className={cn(
                      isFullWidth
                        ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
                        : 'divide-y divide-border'
                    )}
                  >
                    {current.slice(0, limit).map((item, idx) => {
                      const href =
                        view === 'documents'
                          ? `/dashboard/clients/${encodeURIComponent(item.clientId)}?tab=documents`
                          : `/dashboard/clients/${encodeURIComponent(item.clientId)}`;

                      return (
                        <li
                          key={`${item.clientId}-${idx}`}
                          className={cn(
                            isFullWidth
                              ? 'rounded-lg border border-border/70 p-3 hover:bg-muted/50 transition-colors'
                              : 'py-3 hover:bg-muted rounded-md'
                          )}
                        >
                          <Link
                            href={href}
                            className="flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="min-w-0">
                              <span className="block break-words text-sm font-medium">{item.name}</span>
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {view === 'documents'
                                  ? `Missing: ${item.missingDocuments.map((type) => DOC_TYPE_LABEL[type]).join(', ')}`
                                  : 'Open profile to review contact details'}
                              </span>
                            </span>
                            <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {limit < current.length && (
                    <Button
                      variant="outline"
                      className="mt-3 w-full"
                      onClick={() => setLimit((value) => value + 10)}
                    >
                      Show more clients
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <div className="mt-4 border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Archived clients are excluded. Required file: Valid ID.</span>
          <Link href="/dashboard/clients?status=all-records" className="font-medium text-primary hover:underline">
            Open Directory &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
