'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Site } from '@/lib/types/property';

interface SitePickerProps {
  sites: Site[];
  currentSiteId: string;
}

export function SitePicker({ sites, currentSiteId }: SitePickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const currentSite = sites.find((s) => s.site_id === currentSiteId) ?? sites[0];

  const handleValueChange = (newSiteId: string) => {
    if (newSiteId !== currentSiteId) {
      startTransition(() => {
        router.push(`/dashboard/properties/map?site=${newSiteId}`);
      });
    }
  };

  return (
    <Select value={currentSiteId} onValueChange={handleValueChange} disabled={isPending}>
      <SelectTrigger className="h-9 w-auto min-w-[160px] max-w-[280px] border-border bg-card hover:bg-row-hover transition-colors font-medium">
        <SelectValue placeholder="Select site">
          {currentSite?.name}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" className="min-w-[240px] max-w-md border-border bg-card">
        {sites.map((s) => (
          <SelectItem
            key={s.site_id}
            value={s.site_id}
            textValue={s.name}
            className="cursor-pointer py-2"
          >
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium text-foreground transition-colors group-hover:text-background group-focus:text-background group-data-[highlighted]:text-background">
                {s.name}
              </span>
              {s.description && (
                <span className="text-xs text-muted-foreground line-clamp-1 transition-colors group-hover:text-muted group-focus:text-muted group-data-[highlighted]:text-muted">
                  {s.description}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
