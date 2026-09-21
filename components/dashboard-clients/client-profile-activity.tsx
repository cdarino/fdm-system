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
import { Plus, Clock, Loader2, X } from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import { formatActivityTime } from '@/lib/format-activity-time';
import { toast } from 'sonner';
import type { ClientListItem, ClientWithDetails } from '@/lib/types/client';

const ACTIVITY_TYPES = ['Call', 'Meeting', 'Email', 'Note', 'Follow-up'];

export function ClientProfileActivity({
  client,
  details,
  onDetailsChange,
}: {
  client: ClientListItem;
  details: ClientWithDetails;
  onDetailsChange: (updater: (prev: ClientWithDetails) => ClientWithDetails) => void;
}) {
  const { addLog } = useClients();

  const [isAdding, setIsAdding] = useState(false);
  const [logType, setLogType] = useState('Call');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await addLog(client.client_id, {
        event_type: logType,
        description: description.trim(),
      });
      onDetailsChange((prev) => ({
        ...prev,
        client_log: [created, ...prev.client_log],
      }));
      setDescription('');
      setIsAdding(false);
      toast.success('Activity logged');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record activity');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Activity history</h3>
          <Badge variant="secondary">{details.client_log.length}</Badge>
        </div>
        <Button
          type="button"
          size="sm"
          variant={isAdding ? 'ghost' : 'outline'}
          onClick={() => setIsAdding((open) => !open)}
          className="h-8 gap-1.5 text-xs"
        >
          {isAdding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {isAdding ? 'Cancel' : 'Record activity'}
        </Button>
      </div>

      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-2 rounded-lg border border-border bg-row-hover p-3 sm:flex-row"
        >
          <Select value={logType} onValueChange={setLogType}>
            <SelectTrigger className="h-9 sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            autoFocus
            placeholder="What was discussed or done?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-9 flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !description.trim()}
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

      {details.client_log.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Nothing recorded yet. Logging calls and visits is what gives the next
          person context on this client.
        </p>
      ) : (
        /* A timeline rather than separate cards: these entries are read in
           sequence, and the rule makes the ordering obvious. */
        <ol className="relative space-y-4 border-l border-border pl-5">
          {details.client_log.map((log) => (
            <li key={log.log_id} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[23px] top-1.5 h-2 w-2 rounded-full bg-border ring-2 ring-card"
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
    </section>
  );
}
