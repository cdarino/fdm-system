'use client';

import { useState } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverClose,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, X, Loader2 } from 'lucide-react';

const CONTACT_TYPES = ['Phone', 'Mobile', 'Email', 'Other'];

interface TextModeProps {
  mode: 'text';
  title: string;
  initialValue: string;
  placeholder?: string;
  onSave: (value: string) => Promise<void>;
  trigger?: React.ReactNode;
}

interface ContactEditModeProps {
  mode: 'contact-edit';
  title?: string;
  initialType: string;
  initialValue: string;
  placeholder?: string;
  onSave: (type: string, value: string) => Promise<void>;
  trigger?: React.ReactNode;
}

interface ContactAddModeProps {
  mode: 'contact-add';
  title?: string;
  initialType?: string;
  placeholder?: string;
  onSave: (type: string, value: string) => Promise<void>;
  trigger: React.ReactNode;
}

export type ClientFloatingEditorProps =
  | TextModeProps
  | ContactEditModeProps
  | ContactAddModeProps;

export function ClientFloatingEditor(props: ClientFloatingEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const initialVal =
    props.mode === 'contact-add' ? '' : props.initialValue ?? '';
  const initialTyp =
    props.mode === 'text' ? '' : props.initialType ?? 'Phone';

  const [value, setValue] = useState(initialVal);
  const [type, setType] = useState(initialTyp);

  // Synchronize field inputs whenever the popover opens.
  function handleOpenChange(open: boolean) {
    if (open) {
      setValue(initialVal);
      setType(initialTyp);
    }
    setIsOpen(open);
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      if (props.mode === 'text') {
        await props.onSave(value);
      } else {
        await props.onSave(type, value);
      }
      setIsOpen(false);
    } catch {
      // Error feedback is handled by caller toast
    } finally {
      setIsSaving(false);
    }
  }

  const title =
    props.title ??
    (props.mode === 'contact-add' ? 'Add contact' : 'Edit contact');

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {props.trigger ?? (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label={title}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-72 space-y-3 p-3"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <p className="text-xs font-semibold text-foreground">{title}</p>
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

        <form onSubmit={handleSubmit} className="space-y-3">
          {props.mode !== 'text' && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Type
              </label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              {props.mode === 'text' ? 'Value' : 'Contact value'}
            </label>
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={props.placeholder ?? 'Enter value...'}
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
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
                disabled={isSaving}
              >
                Cancel
              </Button>
            </PopoverClose>
            <Button
              type="submit"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
