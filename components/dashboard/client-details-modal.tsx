'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Phone,
  Mail,
  HelpCircle,
  Clock,
  LandPlot,
  Loader2,
} from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import { formatActivityTime } from '@/lib/format-activity-time';
import { toast } from 'sonner';
import type { ClientListItem, ClientWithDetails } from '@/lib/types/client';

export function ClientDetailsModal({
  client,
  open,
}: {
  client: ClientListItem;
  open: boolean;
}) {
  // TODO: find a way to have multiple useMutation(), 
  // so that we could have some error & state handling for these operations here.
  // Right now, there are functions dedicated for each operation that does the same thing!
  const { getClientDetails, addContact, deleteContact, addLog, closeDialog } = useClients();
  const [details, setDetails] = useState<ClientWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [contactType, setContactType] = useState('Phone');
  const [contactValue, setContactValue] = useState('');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  const [logType, setLogType] = useState('Call');
  const [logDescription, setLogDescription] = useState('');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setError(null);
    getClientDetails(client.client_id)
      .then((data) => setDetails(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load client profile'))
      .finally(() => setIsLoading(false));
  }, [open, client.client_id, getClientDetails]);

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactValue.trim()) return;
    setIsSubmittingContact(true);
    try {
      const created = await addContact(client.client_id, {
        type: contactType,
        value: contactValue.trim(),
        is_primary: (details?.contact_info.length ?? 0) === 0,
      });
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              contact_info: [created, ...prev.contact_info],
            }
          : null
      );
      setContactValue('');
      toast.success('Contact added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setIsSubmittingContact(false);
    }
  }

  async function handleDeleteContact(contactId: string) {
    try {
      await deleteContact(client.client_id, contactId);
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              contact_info: prev.contact_info.filter((c) => c.contact_id !== contactId),
            }
          : null
      );
      toast.success('Contact removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  }

  async function handleAddLog(e: React.FormEvent) {
    e.preventDefault();
    if (!logDescription.trim()) return;
    setIsSubmittingLog(true);
    try {
      const created = await addLog(client.client_id, {
        event_type: logType,
        description: logDescription.trim(),
      });
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              client_log: [created, ...prev.client_log],
            }
          : null
      );
      setLogDescription('');
      toast.success('Activity logged');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record activity');
    } finally {
      setIsSubmittingLog(false);
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied "${text}" to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{client.full_name}</DialogTitle>
          <DialogDescription>
            {client.address || 'No address recorded'}
            {client.tin_number ? ` · TIN ${client.tin_number}` : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">{error}</div>
        ) : details ? (
          <div className="space-y-6 pt-2">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Contact Information */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Contact details</h3>
                  <Badge variant="secondary">{details.contact_info.length}</Badge>
                </div>

                <div className="space-y-2">
                  {details.contact_info.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No contact numbers or emails recorded.</p>
                  ) : (
                    details.contact_info.map((contact) => {
                      const isPhone = contact.type.toLowerCase().includes('phone') || contact.type.toLowerCase().includes('mobile');
                      const Icon = isPhone ? Phone : contact.type.toLowerCase().includes('email') ? Mail : HelpCircle;
                      const isCopied = copiedId === contact.contact_id;

                      return (
                        <div
                          key={contact.contact_id}
                          className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5 text-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground">{contact.value}</p>
                              <p className="text-xs text-muted-foreground">{contact.type}</p>
                            </div>
                            {contact.is_primary && (
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                Primary
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleCopy(contact.value, contact.contact_id)}
                              aria-label={`Copy ${contact.value}`}
                            >
                              {isCopied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteContact(contact.contact_id)}
                              aria-label={`Delete ${contact.value}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handleAddContact} className="space-y-2.5 rounded-lg border border-dashed border-border p-3">
                  <p className="text-xs font-medium text-foreground">Add new contact</p>
                  <div className="flex gap-2">
                    <div className="w-28 shrink-0">
                      <Select value={contactType} onValueChange={setContactType}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Phone">Phone</SelectItem>
                          <SelectItem value="Mobile">Mobile</SelectItem>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="e.g. 0917-123-4567"
                      value={contactValue}
                      onChange={(e) => setContactValue(e.target.value)}
                      className="h-9 flex-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingContact || !contactValue.trim()}
                    className="w-full gap-1.5"
                  >
                    {isSubmittingContact ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add contact
                  </Button>
                </form>
              </div>

              {/* Activity History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Activity history</h3>
                  <Badge variant="secondary">{details.client_log.length}</Badge>
                </div>

                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {details.client_log.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No activity history recorded.</p>
                  ) : (
                    details.client_log.map((log) => (
                      <div
                        key={log.log_id}
                        className="rounded-lg border border-border bg-card p-2.5 text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">{log.event_type}</span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatActivityTime(log.time)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {log.description || 'No description provided'}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddLog} className="space-y-2.5 rounded-lg border border-dashed border-border p-3">
                  <p className="text-xs font-medium text-foreground">Record activity</p>
                  <div className="flex gap-2">
                    <div className="w-28 shrink-0">
                      <Select value={logType} onValueChange={setLogType}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Call">Call</SelectItem>
                          <SelectItem value="Meeting">Meeting</SelectItem>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Note">Note</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="What was discussed or done?"
                      value={logDescription}
                      onChange={(e) => setLogDescription(e.target.value)}
                      className="h-9 flex-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingLog || !logDescription.trim()}
                    className="w-full gap-1.5"
                  >
                    {isSubmittingLog ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Record activity
                  </Button>
                </form>
              </div>
            </div>

            {/* Associated Property Lots */}
            {details.properties && details.properties.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Assigned Property Lots</h3>
                  <Badge variant="outline">{details.properties.length}</Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {details.properties.map((lot) => (
                    <div
                      key={lot.property_id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-row-hover">
                        <LandPlot className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          Block {lot.block_number} Lot {lot.lot_number}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{lot.location}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {lot.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={closeDialog}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

