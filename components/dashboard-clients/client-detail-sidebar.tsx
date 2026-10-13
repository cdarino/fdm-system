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
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { ActivityTime } from '@/components/shared/activity-time';
import { useClientDetail } from '@/lib/hooks/use-client-detail';
import { ClientFloatingEditor } from './client-floating-editor';
import {
  GENDERS,
  type CivilStatus,
  type Gender,
} from '@/lib/types/client';

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

export function ClientDetailSidebar() {
  const {
    client,
    updateAddress,
    updateTin,
    updateCivilStatus,
    updateGender,
    addContact,
    updateContact,
    deleteContact,
    setPrimaryContact,
    addActivity,
  } = useClientDetail();

  // Activity state
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [activityType, setActivityType] = useState('Call');
  const [activityDescription, setActivityDescription] = useState('');
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleUpdateAddress(address: string) {
    try {
      await updateAddress(address);
      toast.success('Address updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update address');
      throw err;
    }
  }

  async function handleUpdateTin(tinNumber: string) {
    try {
      await updateTin(tinNumber);
      toast.success('TIN number updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update TIN number');
      throw err;
    }
  }

  async function handleUpdateCivilStatus(civilStatus: string, spouseName?: string) {
    try {
      await updateCivilStatus(civilStatus as CivilStatus, spouseName);
      toast.success('Civil status updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update civil status');
      throw err;
    }
  }

  async function handleUpdateGender(gender: string) {
    try {
      await updateGender(gender as Gender);
      toast.success('Gender updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update gender');
      throw err;
    }
  }

  async function handleAddContact(type: string, value: string) {
    if (!value.trim()) return;
    try {
      await addContact(type, value);
      toast.success('Contact added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add contact');
      throw err;
    }
  }

  async function handleUpdateContact(contactId: string, type: string, value: string) {
    if (!value.trim()) return;
    try {
      await updateContact(contactId, type, value);
      toast.success('Contact updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update contact');
      throw err;
    }
  }

  async function handleDeleteContact(contactId: string) {
    try {
      await deleteContact(contactId);
      toast.success('Contact removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  }

  async function handleSetPrimaryContact(contactId: string) {
    try {
      await setPrimaryContact(contactId);
      toast.success('Primary contact updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set primary contact');
    }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!activityDescription.trim()) return;

    setIsSubmittingActivity(true);
    try {
      await addActivity({
        event_type: activityType,
        description: activityDescription.trim(),
      });
      setActivityDescription('');
      setIsAddingActivity(false);
      toast.success('Activity logged');
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

  const civilStatusDisplay = client.civil_status ? (
    client.civil_status === 'Married' ? (
      client.spouse_name ? (
        <span>
          Married <span className="text-muted-foreground">• Spouse:</span> {client.spouse_name}
        </span>
      ) : (
        <span>
          Married <span className="text-muted-foreground">• Spouse:</span>{' '}
          <span className="italic text-destructive">Required</span>
        </span>
      )
    ) : (
      client.civil_status
    )
  ) : (
    <span className="italic text-muted-foreground">Not provided</span>
  );

  const copyCivilStatusText =
    client.civil_status === 'Married' && client.spouse_name
      ? `Married • Spouse: ${client.spouse_name}`
      : client.civil_status || '';

  return (
    <div className="flex flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
      {/* Sticky top region */}
      <div className="shrink-0 bg-background pb-3 lg:sticky lg:top-0 lg:z-10">
        {/* Top back navigation */}
        <div className="flex items-center pb-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
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
      </div>

      {/* Scrollable body region */}
      <div className="pr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">1. Identity &amp; contacts</p>
        {/* Structured Details and Contacts Card */}
        <Card variant="canvas" className="overflow-hidden">
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

          {/* Separator between [Address, TIN] and [Civil status, Gender] */}
          <div className="my-1 border-t border-border-warm-subtle" />

          {/* Civil Status Row (with integrated Spouse details) */}
          <div className="group flex items-center justify-between gap-2 rounded-lg p-2 transition-colors hover:bg-row-hover">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground">Civil status</p>
                <p className="truncate text-sm text-foreground">
                  {civilStatusDisplay}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                disabled={!client.civil_status}
                onClick={() => copyCivilStatusText && handleCopy(copyCivilStatusText, 'civil_status')}
                aria-label="Copy civil status"
              >
                {copiedId === 'civil_status' ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              <ClientFloatingEditor
                mode="civil-status"
                title="Edit civil status"
                initialCivilStatus={client.civil_status || 'Single'}
                initialSpouseName={client.spouse_name || ''}
                onSave={handleUpdateCivilStatus}
              />
            </div>
          </div>

          {/* Gender Row */}
          <div className="group flex items-center justify-between gap-2 rounded-lg p-2 transition-colors hover:bg-row-hover">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground">Gender</p>
                <p className="truncate text-sm text-foreground">
                  {client.gender || <span className="italic text-muted-foreground">Not provided</span>}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                disabled={!client.gender}
                onClick={() => client.gender && handleCopy(client.gender, 'gender')}
                aria-label="Copy gender"
              >
                {copiedId === 'gender' ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              <ClientFloatingEditor
                mode="select"
                title="Edit gender"
                initialValue={client.gender || 'Male'}
                options={GENDERS}
                onSave={handleUpdateGender}
              />
            </div>
          </div>

          {/* Separator between [Civil status, Gender] and [Contacts] */}
          <div className="my-1 border-t border-border-warm-subtle" />

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
        <div className="flex flex-col pb-6 pt-0.5">
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

          <div>
            {client.client_log.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-warm bg-row-hover px-3 py-6 text-center text-xs text-muted-foreground">
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
                        <ActivityTime timestamp={log.time} />
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {log.description || 'No description provided'}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Recorded by {log.performer_name ?? (log.performed_by ? 'Staff member' : 'System')}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
