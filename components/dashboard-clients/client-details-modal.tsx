'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, ShieldCheck, UserRound } from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import { ClientProfileContacts } from './client-profile-contacts';
import { ClientProfileDocuments } from './client-profile-documents';
import { ClientProfileProperties } from './client-profile-properties';
import { ClientProfileActivity } from './client-profile-activity';
import {
  REQUIRED_CLIENT_DOCUMENTS,
  type ClientListItem,
  type ClientWithDetails,
} from '@/lib/types/client';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The consolidated client profile (r18).
 *
 * Tabbed rather than one long scroll: the four areas are read separately, and
 * stacking them meant every visit scrolled past three sections to reach the
 * one that was wanted. What stays outside the tabs is what is true regardless
 * of which one is open, namely who the client is and whether their paperwork
 * is complete.
 *
 * Each tab is its own component under components/dashboard-clients/. They share
 * the loaded profile and a single updater, so a change made in one tab is
 * reflected in the counts on the others without a refetch.
 */
export function ClientDetailsModal({
  client,
  open,
}: {
  client: ClientListItem;
  open: boolean;
}) {
  const { getClientDetails, closeDialog } = useClients();

  const [details, setDetails] = useState<ClientWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setError(null);
    getClientDetails(client.client_id)
      .then((data) => setDetails(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Unable to load client profile'),
      )
      .finally(() => setIsLoading(false));
  }, [open, client.client_id, getClientDetails]);

  function updateDetails(updater: (prev: ClientWithDetails) => ClientWithDetails) {
    setDetails((prev) => (prev ? updater(prev) : prev));
  }

  const documents = details?.client_document ?? [];
  const missingCount = details
    ? REQUIRED_CLIENT_DOCUMENTS.filter(
        (type) => !documents.some((doc) => doc.document_type === type),
      ).length
    : 0;

  const sectionProps = details
    ? { client, details, onDetailsChange: updateDetails }
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl lg:max-w-5xl">
        {/* Identity stays put while the tabs change beneath it. */}
        <DialogHeader className="space-y-0">
          <div className="flex items-start gap-3 pr-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-row-hover text-sm font-semibold text-muted-foreground ring-1 ring-inset ring-border">
              {initials(client.full_name) || <UserRound className="h-5 w-5" />}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-lg font-bold leading-tight">
                  {client.full_name}
                </DialogTitle>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  {client.status}
                </Badge>
              </div>

              <DialogDescription className="text-xs">
                {client.address || 'No address recorded'}
                {client.tin_number ? ` · TIN ${client.tin_number}` : ''}
              </DialogDescription>

              {details && (
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  {missingCount === 0 ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 text-success" />
                      <span className="text-muted-foreground">Files complete</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-muted-foreground">
                        {missingCount} required document
                        {missingCount === 1 ? '' : 's'} missing
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-destructive">{error}</div>
        ) : sectionProps && details ? (
          <Tabs defaultValue="contacts" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="shrink-0">
              <TabsTrigger value="contacts">
                Contacts
                <span className="text-xs tabular-nums text-muted-foreground">
                  {details.contact_info.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="documents">
                Documents
                <span className="text-xs tabular-nums text-muted-foreground">
                  {documents.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="properties">
                Lots
                <span className="text-xs tabular-nums text-muted-foreground">
                  {details.properties?.length ?? 0}
                </span>
              </TabsTrigger>
              <TabsTrigger value="activity">
                Activity
                <span className="text-xs tabular-nums text-muted-foreground">
                  {details.client_log.length}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Scrolling lives on the panel, not the dialog, so the header and
                tabs never leave the screen. */}
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <TabsContent value="contacts">
                <ClientProfileContacts {...sectionProps} />
              </TabsContent>
              <TabsContent value="documents">
                <ClientProfileDocuments {...sectionProps} />
              </TabsContent>
              <TabsContent value="properties">
                <ClientProfileProperties {...sectionProps} />
              </TabsContent>
              <TabsContent value="activity">
                <ClientProfileActivity {...sectionProps} />
              </TabsContent>
            </div>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
