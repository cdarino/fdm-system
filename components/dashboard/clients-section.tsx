'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Edit3,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  addContactInfo,
  createClient,
  createClientLog,
  deleteClient,
  getClientById,
  updateClient,
} from '@/lib/actions/clients';
import type { Client, ClientWithDetails } from '@/lib/types/client';

interface ClientsSectionProps {
  clients: Client[];
}

type ClientForm = {
  full_name: string;
  address: string;
  tin_number: string;
  status: string;
};

type ClientStatusFilter = 'all' | 'active' | 'inactive';

const emptyForm: ClientForm = {
  full_name: '',
  address: '',
  tin_number: '',
  status: 'Active',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusClass(status: string) {
  return status.toLowerCase() === 'active'
    ? 'bg-[color-mix(in_srgb,var(--success)_12%,white)] text-success'
    : 'bg-muted text-muted-foreground';
}

function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: ClientStatusFilter;
  onChange: (value: ClientStatusFilter) => void;
  counts: Record<ClientStatusFilter, number>;
}) {
  const tabs: { value: ClientStatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  return (
    <div role="tablist" aria-label="Filter clients by status" className="inline-flex items-center gap-1 rounded-lg bg-row-hover p-1">
      {tabs.map((tab) => {
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              isActive
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span className={`text-xs tabular-nums ${isActive ? 'text-muted-foreground' : ''}`}>
              {counts[tab.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ClientsSection({ clients: initialClients }: ClientsSectionProps) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [selectedClient, setSelectedClient] = useState<ClientWithDetails | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [contactType, setContactType] = useState('Email');
  const [contactValue, setContactValue] = useState('');
  const [logType, setLogType] = useState('Note');
  const [logDescription, setLogDescription] = useState('');
  const [pending, setPending] = useState(false);

  const filteredClients = clients.filter((client) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || client.full_name.toLowerCase().includes(term) || client.tin_number?.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'all' || client.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts: Record<ClientStatusFilter, number> = {
    all: clients.length,
    active: clients.filter((client) => client.status.toLowerCase() === 'active').length,
    inactive: clients.filter((client) => client.status.toLowerCase() === 'inactive').length,
  };

  function openCreate() {
    setEditingClient(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setForm({
      full_name: client.full_name,
      address: client.address ?? '',
      tin_number: client.tin_number ?? '',
      status: client.status,
    });
    setFormOpen(true);
  }

  async function handleSaveClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.full_name.trim()) {
      toast.error('Full name is required.');
      return;
    }

    setPending(true);
    try {
      if (editingClient) {
        const updated = await updateClient(editingClient.client_id, form);
        setClients((current) => current.map((client) => client.client_id === updated.client_id ? updated : client));
        setSelectedClient((current) => current?.client_id === updated.client_id ? { ...current, ...updated } : current);
        toast.success('Client updated.');
      } else {
        const created = await createClient(form);
        setClients((current) => [created, ...current]);
        toast.success('Client created.');
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save client.');
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(client: Client) {
    if (!window.confirm(`Delete ${client.full_name}? This cannot be undone.`)) return;

    setPending(true);
    try {
      await deleteClient(client.client_id);
      setClients((current) => current.filter((item) => item.client_id !== client.client_id));
      if (selectedClient?.client_id === client.client_id) {
        setSelectedClient(null);
        setDetailOpen(false);
      }
      toast.success('Client deleted.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete client.');
    } finally {
      setPending(false);
    }
  }

  async function openDetails(client: Client) {
    setPending(true);
    try {
      const details = await getClientById(client.client_id);
      setSelectedClient(details);
      setDetailOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load client details.');
    } finally {
      setPending(false);
    }
  }

  async function handleAddContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClient || !contactValue.trim()) return;

    setPending(true);
    try {
      const contact = await addContactInfo(selectedClient.client_id, {
        type: contactType,
        value: contactValue,
        is_primary: selectedClient.contact_info.length === 0,
      });
      setSelectedClient((current) => current ? { ...current, contact_info: [contact, ...current.contact_info] } : current);
      setContactValue('');
      toast.success('Contact information added.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add contact information.');
    } finally {
      setPending(false);
    }
  }

  async function handleAddLog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClient || !logDescription.trim()) return;

    setPending(true);
    try {
      const log = await createClientLog(selectedClient.client_id, {
        event_type: logType,
        description: logDescription,
      });
      setSelectedClient((current) => current ? { ...current, client_log: [log, ...current.client_log] } : current);
      setLogDescription('');
      toast.success('Client log recorded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to record client log.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Client directory</h2>
            <p className="text-sm text-muted-foreground">Store client records, contact information, and activity history.</p>
          </div>
          <Button onClick={openCreate}>
            <Plus />
            Add client
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-b border-border p-4 sm:p-6">
          <StatusTabs value={statusFilter} onChange={setStatusFilter} counts={counts} />
          <div className="relative w-full max-w-sm sm:ml-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search clients"
              className="pl-9"
              placeholder="Search by name or TIN"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>TIN</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No clients found.</TableCell>
              </TableRow>
            ) : filteredClients.map((client) => (
              <TableRow key={client.client_id} className="group">
                <TableCell>
                  <button className="flex items-center gap-3 text-left" onClick={() => openDetails(client)}>
                    <span className="flex size-9 items-center justify-center rounded-full bg-row-hover text-muted-foreground"><UserRound className="size-4" /></span>
                    <span>
                      <span className="block font-medium text-foreground">{client.full_name}</span>
                      <span className="block max-w-xs truncate text-xs text-muted-foreground">{client.address || 'No address recorded'}</span>
                    </span>
                  </button>
                </TableCell>
                <TableCell className="text-muted-foreground">{client.tin_number || 'Not provided'}</TableCell>
                <TableCell><Badge className={statusClass(client.status)}>{client.status}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{formatDate(client.updated_at)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-label={`Actions for ${client.full_name}`} className="opacity-70 group-hover:opacity-100" size="icon" variant="ghost"><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openDetails(client)}><Activity />View details</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEdit(client)}><Edit3 />Edit client</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => handleDelete(client)}><Trash2 />Delete client</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit client' : 'Add client'}</DialogTitle>
            <DialogDescription>Record the client&apos;s core information.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveClient}>
            <label className="block space-y-1.5 text-sm font-medium">Full name<Input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
            <label className="block space-y-1.5 text-sm font-medium">Address<Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
            <label className="block space-y-1.5 text-sm font-medium">TIN number<Input value={form.tin_number} onChange={(event) => setForm({ ...form, tin_number: event.target.value })} /></label>
            <label className="block space-y-1.5 text-sm font-medium">Status<select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button disabled={pending} type="submit">{pending && <Loader2 className="animate-spin" />}Save client</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedClient.full_name}</DialogTitle>
                <DialogDescription>{selectedClient.address || 'No address recorded'}{selectedClient.tin_number ? ` · TIN ${selectedClient.tin_number}` : ''}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 md:grid-cols-2">
                <section className="space-y-3">
                  <div className="flex items-center justify-between"><h3 className="font-semibold">Contact information</h3><Badge variant="secondary">{selectedClient.contact_info.length}</Badge></div>
                  <div className="space-y-2">
                    {selectedClient.contact_info.map((contact) => <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm" key={contact.contact_id}><span><span className="block font-medium">{contact.type}</span><span className="text-muted-foreground">{contact.value}</span></span>{contact.is_primary && <Badge variant="outline">Primary</Badge>}</div>)}
                    {selectedClient.contact_info.length === 0 && <p className="text-sm text-muted-foreground">No contact information recorded.</p>}
                  </div>
                  <form className="space-y-2 rounded-md border border-dashed border-border p-3" onSubmit={handleAddContact}>
                    <div className="flex gap-2"><select className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" value={contactType} onChange={(event) => setContactType(event.target.value)}><option>Email</option><option>Phone</option><option>Other</option></select><Input placeholder="Contact value" value={contactValue} onChange={(event) => setContactValue(event.target.value)} /></div>
                    <Button disabled={pending || !contactValue.trim()} size="sm" type="submit"><Plus />Add contact</Button>
                  </form>
                </section>
                <section className="space-y-3">
                  <div className="flex items-center justify-between"><h3 className="font-semibold">Activity log</h3><Badge variant="secondary">{selectedClient.client_log.length}</Badge></div>
                  <div className="space-y-2">
                    {selectedClient.client_log.map((log) => <div className="rounded-md border border-border p-3 text-sm" key={log.log_id}><div className="flex items-center justify-between gap-2"><span className="font-medium">{log.event_type}</span><span className="text-xs text-muted-foreground">{formatDate(log.time)}</span></div><p className="mt-1 text-muted-foreground">{log.description || 'No description'}</p></div>)}
                    {selectedClient.client_log.length === 0 && <p className="text-sm text-muted-foreground">No activity recorded.</p>}
                  </div>
                  <form className="space-y-2 rounded-md border border-dashed border-border p-3" onSubmit={handleAddLog}>
                    <div className="flex gap-2"><Input aria-label="Log event type" placeholder="Event type" value={logType} onChange={(event) => setLogType(event.target.value)} /><Button disabled={pending || !logDescription.trim()} size="sm" type="submit"><Plus />Record log</Button></div>
                    <textarea className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="What happened?" value={logDescription} onChange={(event) => setLogDescription(event.target.value)} />
                  </form>
                </section>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setDetailOpen(false)}><X />Close</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
