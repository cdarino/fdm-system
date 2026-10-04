'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import { Input } from '@/components/ui/input';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from '@/components/ui/popover';
import {
  ArrowLeft,
  UserRound,
  Clock,
  Plus,
  X,
  Loader2,
  Phone,
  Mail,
  HelpCircle,
  Copy,
  Check,
  MoreHorizontal,
  Star,
  Trash2,
  MapPin,
  FileText,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatActivityTime } from '@/lib/format-activity-time';
import {
  updateClient,
  addContactInfo,
  deleteContactInfo,
  updateContactInfo,
  createClientLog,
} from '@/lib/actions/clients';
import { ClientFloatingEditor } from './client-floating-editor';
import type { ClientWithDetails } from '@/lib/types/client';

const ACTIVITY_TYPES = ['Call', 'Meeting', 'Email', 'Note', 'Follow-up'];

function contactIcon(type: string) {
  const lowered = type.toLowerCase();
  if (lowered.includes('phone') || lowered.includes('mobile')) return Phone;
  if (lowered.includes('email')) return Mail;
  return HelpCircle;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface ClientDetailSidebarProps {
  client: ClientWithDetails;
  onClientChange: (client: ClientWithDetails | ((prev: ClientWithDetails) => ClientWithDetails)) => void;
}

export function ClientDetailSidebar({ client, onClientChange }: ClientDetailSidebarProps) {
  const router = useRouter();

  // Activity state
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [activityType, setActivityType] = useState('Call');
  const [activityDescription, setActivityDescription] = useState('');
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleUpdateAddress(address: string) {
    const trimmed = address.trim() || null;
    const result = await updateClient(client.client_id, { address: trimmed });
    if (!result.success) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    onClientChange((prev) => ({ ...prev, address: result.data.address }));
    toast.success('Address updated');
    router.refresh();
  }

  async function handleUpdateTin(tin_number: string) {
    const trimmed = tin_number.trim() || null;
    const result = await updateClient(client.client_id, { tin_number: trimmed });
    if (!result.success) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    onClientChange((prev) => ({ ...prev, tin_number: result.data.tin_number }));
    toast.success('TIN number updated');
    router.refresh();
  }

  async function handleAddContact(type: string, value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;

    const result = await addContactInfo(client.client_id, {
      type,
      value: trimmed,
      is_primary: client.contact_info.length === 0,
    });

    if (!result.success) {
      toast.error(result.error);
      throw new Error(result.error);
    }

    onClientChange((prev) => ({
      ...prev,
      contact_info: [result.data, ...prev.contact_info],
    }));
    toast.success('Contact added');
    router.refresh();
  }

  async function handleUpdateContact(contactId: string, type: string, value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;

    const result = await updateContactInfo(contactId, { type, value: trimmed });
    if (!result.success) {
      toast.error(result.error);
      throw new Error(result.error);
    }

    onClientChange((prev) => ({
      ...prev,
      contact_info: prev.contact_info.map((c) =>
        c.contact_id === contactId ? { ...c, type: result.data.type, value: result.data.value } : c
      ),
    }));
    toast.success('Contact updated');
    router.refresh();
  }

  async function handleDeleteContact(contactId: string) {
    try {
      const result = await deleteContactInfo(contactId);
      if (!result.success) {
        throw new Error(result.error);
      }

      onClientChange((prev) => ({
        ...prev,
        contact_info: prev.contact_info.filter((c) => c.contact_id !== contactId),
      }));
      toast.success('Contact removed');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  }

  async function handleSetPrimaryContact(contactId: string) {
    try {
      const result = await updateContactInfo(contactId, { is_primary: true });
      if (!result.success) {
        throw new Error(result.error);
      }

      onClientChange((prev) => ({
        ...prev,
        contact_info: prev.contact_info.map((c) => ({
          ...c,
          is_primary: c.contact_id === contactId,
        })),
      }));
      toast.success('Primary contact updated');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set primary contact');
    }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!activityDescription.trim()) return;

    setIsSubmittingActivity(true);
    try {
      const created = await createClientLog(client.client_id, {
        event_type: activityType,
        description: activityDescription.trim(),
      });

      onClientChange((prev) => ({
        ...prev,
        client_log: [created, ...prev.client_log],
      }));
      setActivityDescription('');
      setIsAddingActivity(false);
      toast.success('Activity logged');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record activity');
    } finally {
      setIsSubmittingActivity(false);
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied "${text}" to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Top back navigation */}
      <div className="flex shrink-0 items-center pb-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Link href="/dashboard/clients">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to clients
          </Link>
        </Button>
      </div>

      {/* Client Identity Header */}
      <Card variant="canvas" padding="sm" className="flex items-start gap-3">
        <IconBox variant="canvas" size="lg" shape="rounded-xl" className="shrink-0 font-semibold">
          {initials(client.full_name) || <UserRound className="h-5 w-5" />}
        </IconBox>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-foreground">{client.full_name}</h2>
            <Badge variant="outline-warm" shape="pill" className="text-[10px] uppercase tracking-wider">
              {client.status}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Structured Details and Contacts Card */}
      <Card variant="canvas" className="mt-3 overflow-hidden">
        <div className="space-y-0.5 p-1.5">
          {/* Address Row */}
          <div className="group flex items-center justify-between gap-2 rounded-lg p-2 transition-colors hover:bg-row-hover">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground">Address</p>
                <p className="truncate text-sm text-foreground">
                  {client.address || <span className="italic text-muted-foreground">Not provided</span>}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                disabled={!client.address}
                onClick={() => client.address && handleCopy(client.address, 'address')}
                aria-label="Copy address"
              >
                {copiedId === 'address' ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              <ClientFloatingEditor
                mode="text"
                title="Edit address"
                initialValue={client.address || ''}
                placeholder="Davao City, Philippines"
                onSave={handleUpdateAddress}
              />
            </div>
          </div>

          {/* TIN Number Row */}
          <div className="group flex items-center justify-between gap-2 rounded-lg p-2 transition-colors hover:bg-row-hover">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground">TIN number</p>
                <p className="truncate text-sm text-foreground">
                  {client.tin_number || <span className="italic text-muted-foreground">Not provided</span>}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                disabled={!client.tin_number}
                onClick={() => client.tin_number && handleCopy(client.tin_number, 'tin')}
                aria-label="Copy TIN"
              >
                {copiedId === 'tin' ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              <ClientFloatingEditor
                mode="text"
                title="Edit TIN number"
                initialValue={client.tin_number || ''}
                placeholder="123-456-789"
                onSave={handleUpdateTin}
              />
            </div>
          </div>

          {/* Contact Items */}
          {client.contact_info.map((contact) => {
            const Icon = contactIcon(contact.type);
            const isCopied = copiedId === contact.contact_id;

            return (
              <div
                key={contact.contact_id}
                className="group flex items-center justify-between gap-2 rounded-lg p-2 transition-colors hover:bg-row-hover"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{contact.value}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">{contact.type}</span>
                      {contact.is_primary && (
                        <Badge variant="outline-warm" shape="pill" className="px-1.5 py-0 text-[9px]">
                          Primary
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
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
                  <ClientFloatingEditor
                    mode="contact-edit"
                    title="Edit contact"
                    initialType={contact.type}
                    initialValue={contact.value}
                    onSave={(type, val) => handleUpdateContact(contact.contact_id, type, val)}
                  />
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
                        icon={<Star className="h-4 w-4" />}
                        onSelect={() => handleSetPrimaryContact(contact.contact_id)}
                      >
                        {contact.is_primary ? 'Primary contact' : 'Set as primary'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        icon={<Trash2 className="h-4 w-4" />}
                        onSelect={() => handleDeleteContact(contact.contact_id)}
                      >
                        Delete contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}

          {/* Empty state if no contacts on record */}
          {client.contact_info.length === 0 && (
            <p className="px-3 py-2 text-xs italic text-muted-foreground">
              No contact details
            </p>
          )}
        </div>

        {/* Add Contact Button with Floating Popup */}
        <div className="border-t border-border-warm-subtle bg-card p-1.5">
          <ClientFloatingEditor
            mode="contact-add"
            title="Add contact"
            onSave={handleAddContact}
            trigger={
              <Button variant="ghost" size="sm" className="h-7 w-full gap-1.5 text-xs text-muted-foreground hover:bg-row-hover hover:text-foreground">
                <Plus className="h-3 w-3" />
                Add contact
              </Button>
            }
          />
        </div>
      </Card>

      {/* Divider line before Activity History */}
      <div className="my-3 border-t border-border-warm" />

      {/* Activity History Section */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden pt-0.5">
        <div className="flex items-center justify-between gap-3 pb-2.5">
          <h3 className="text-xs font-semibold text-foreground">Activity history</h3>
          <Popover open={isAddingActivity} onOpenChange={setIsAddingActivity}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="canvas"
                className="h-7 gap-1.5 text-xs"
              >
                <Plus className="h-3 w-3" />
                Record
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="start"
              sideOffset={8}
              className="w-80 space-y-3 p-3 border-border-warm shadow-md"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border-warm pb-2">
                <p className="text-xs font-semibold text-foreground">Record activity</p>
                <PopoverClose asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    aria-label="Close editor"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </PopoverClose>
              </div>

              <form onSubmit={handleAddActivity} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Type
                  </label>
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((type) => (
                        <SelectItem key={type} value={type} className="text-xs">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Description
                  </label>
                  <Input
                    autoFocus
                    placeholder="What was discussed or done?"
                    value={activityDescription}
                    onChange={(e) => setActivityDescription(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddActivity(e);
                      }
                    }}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <PopoverClose asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={isSubmittingActivity}
                    >
                      Cancel
                    </Button>
                  </PopoverClose>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    disabled={isSubmittingActivity || !activityDescription.trim()}
                  >
                    {isSubmittingActivity ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Save activity
                  </Button>
                </div>
              </form>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {client.client_log.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-warm bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
              No activity recorded yet
            </p>
          ) : (
            <ol className="relative space-y-3.5 border-l-2 border-border-warm pl-4 ml-1.5">
              {client.client_log.map((log) => (
                <li key={log.log_id} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-border-warm ring-2 ring-background"
                  />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-xs font-semibold text-foreground">
                      {log.event_type}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatActivityTime(log.time)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {log.description || 'No description provided'}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
