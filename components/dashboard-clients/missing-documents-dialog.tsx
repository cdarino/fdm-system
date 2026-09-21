'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Phone, Mail, HelpCircle, UserRound } from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import type { ClientListItem, ClientDocumentNotification } from '@/lib/types/client';

function ContactLine({ contact }: { contact: ClientDocumentNotification['contact'] }) {
  if (!contact) {
    return (
      <span className="text-xs text-destructive">
        No contact details on record
      </span>
    );
  }

  const type = contact.type.toLowerCase();
  const Icon = type.includes('phone') || type.includes('mobile')
    ? Phone
    : type.includes('email')
      ? Mail
      : HelpCircle;

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3 shrink-0" />
      {contact.value}
    </span>
  );
}

/**
 * Everyone whose required paperwork is incomplete, in one list.
 *
 * Each row carries the client's primary contact, because the point of the alert
 * is chasing the missing document, and staff should not have to open a profile
 * to find a phone number.
 */
export function MissingDocumentsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { missingDocumentAlerts, clients, openDialog } = useClients();

  function openClientProfile(clientId: string) {
    const client: ClientListItem | undefined = clients.find(
      (c) => c.client_id === clientId
    );
    if (!client) return;
    onOpenChange(false);
    openDialog({ type: 'details', client });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Incomplete client files</DialogTitle>
          <DialogDescription>
            Clients missing a Valid ID, Contract or Deed of Sale. Archived
            clients are not included.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 min-h-40 overflow-y-auto rounded-lg border border-border">
          {missingDocumentAlerts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <ShieldCheck className="h-5 w-5 text-success" />
              <p className="text-sm font-medium text-foreground">
                Every client file is complete
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Nothing needs chasing right now.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {missingDocumentAlerts.map((alert) => (
                <li key={alert.client_id} className="flex items-start gap-3 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-row-hover ring-1 ring-inset ring-border">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {alert.full_name}
                    </p>
                    <ContactLine contact={alert.contact} />
                    <div className="flex flex-wrap gap-1">
                      {alert.missing_documents.map((type) => (
                        <Badge
                          key={type}
                          variant="outline"
                          className="border-destructive text-[10px] text-destructive"
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openClientProfile(alert.client_id)}
                    className="h-8 shrink-0 border-border bg-card text-xs text-foreground hover:bg-row-hover hover:text-foreground"
                  >
                    Open profile
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
