'use client';

import { useState } from 'react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Phone,
  Mail,
  HelpCircle,
  Loader2,
  MoreHorizontal,
  Star,
  X,
} from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import { toast } from 'sonner';
import type { ClientListItem, ClientWithDetails } from '@/lib/types/client';

const CONTACT_TYPES = ['Phone', 'Mobile', 'Email', 'Other'];

function contactIcon(type: string) {
  const lowered = type.toLowerCase();
  if (lowered.includes('phone') || lowered.includes('mobile')) return Phone;
  if (lowered.includes('email')) return Mail;
  return HelpCircle;
}

export function ClientProfileContacts({
  client,
  details,
  onDetailsChange,
}: {
  client: ClientListItem;
  details: ClientWithDetails;
  onDetailsChange: (updater: (prev: ClientWithDetails) => ClientWithDetails) => void;
}) {
  const { addContact, deleteContact, setPrimaryContact } = useClients();

  // The form stays closed until asked for. Four always-open forms were most of
  // what made this panel feel cluttered.
  const [isAdding, setIsAdding] = useState(false);
  const [contactType, setContactType] = useState('Phone');
  const [contactValue, setContactValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!contactValue.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await addContact(client.client_id, {
        type: contactType,
        value: contactValue.trim(),
        is_primary: details.contact_info.length === 0,
      });
      onDetailsChange((prev) => ({
        ...prev,
        contact_info: [created, ...prev.contact_info],
      }));
      setContactValue('');
      setIsAdding(false);
      toast.success('Contact added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(contactId: string) {
    try {
      await deleteContact(client.client_id, contactId);
      onDetailsChange((prev) => ({
        ...prev,
        contact_info: prev.contact_info.filter((c) => c.contact_id !== contactId),
      }));
      toast.success('Contact removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  }

  async function handleSetPrimary(contactId: string) {
    try {
      await setPrimaryContact(client.client_id, contactId);
      onDetailsChange((prev) => ({
        ...prev,
        contact_info: prev.contact_info.map((c) => ({
          ...c,
          is_primary: c.contact_id === contactId,
        })),
      }));
      toast.success('Primary contact updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set primary contact');
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied "${text}" to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Contact details</h3>
          <Badge variant="secondary">{details.contact_info.length}</Badge>
        </div>
        <Button
          type="button"
          size="sm"
          variant={isAdding ? 'ghost' : 'outline'}
          onClick={() => setIsAdding((open) => !open)}
          className="h-8 gap-1.5 text-xs"
        >
          {isAdding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {isAdding ? 'Cancel' : 'Add contact'}
        </Button>
      </div>

      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-2 rounded-lg border border-border bg-row-hover p-3 sm:flex-row"
        >
          <Select value={contactType} onValueChange={setContactType}>
            <SelectTrigger className="h-9 sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            autoFocus
            placeholder="Number or email address"
            value={contactValue}
            onChange={(e) => setContactValue(e.target.value)}
            className="h-9 flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !contactValue.trim()}
            className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </form>
      )}

      {details.contact_info.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          No numbers or email addresses on record. This is how title releases get
          delayed, so add one as soon as it is known.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {details.contact_info.map((contact) => {
            const Icon = contactIcon(contact.type);
            const isCopied = copiedId === contact.contact_id;

            return (
              <li
                key={contact.contact_id}
                className="flex items-center gap-3 p-2.5 transition-colors hover:bg-row-hover"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {contact.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{contact.type}</p>
                </div>

                {contact.is_primary && (
                  <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wider">
                    Primary
                  </Badge>
                )}

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => handleCopy(contact.value, contact.contact_id)}
                    aria-label={`Copy ${contact.value}`}
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        aria-label={`Actions for ${contact.value}`}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        disabled={contact.is_primary}
                        onSelect={() => handleSetPrimary(contact.contact_id)}
                      >
                        <Star className="mr-2 h-4 w-4" />
                        {contact.is_primary ? 'Primary contact' : 'Set as primary'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => handleDelete(contact.contact_id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
