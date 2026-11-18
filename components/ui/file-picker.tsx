'use client';

import { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilePickerProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
  maxBytes?: number;
  disabled?: boolean;
  className?: string;
  buttonLabel?: string;
}

function formatByteLimit(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

/**
 * A file input shown as a normal button plus the chosen file's name. The
 * browser's own file input is hidden because it cannot be styled to look or
 * behave like the app's buttons.
 */
export function FilePicker({
  file,
  onFileChange,
  accept,
  maxBytes,
  disabled,
  className,
  buttonLabel = 'Choose file',
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const maxLabel = maxBytes ? formatByteLimit(maxBytes) : null;

  return (
    <div className={cn('w-full min-w-0 space-y-1.5', className)}>
      <div className="flex w-full min-w-0 items-center gap-2 overflow-hidden">
        <Button
          type="button"
          variant="quiet"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" />
          {file ? 'Change file' : buttonLabel}
        </Button>

        <span
          className={cn('min-w-0 flex-1 truncate text-sm', file ? 'text-foreground' : 'text-muted-foreground')}
          title={file ? file.name : undefined}
        >
          {file ? file.name : 'No file chosen'}
        </span>

        {file && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSizeError(null);
              onFileChange(null);
            }}
            aria-label="Clear chosen file"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            // Reset input value so re-selecting the same file still fires onChange.
            e.target.value = '';
            if (maxBytes && picked && picked.size > maxBytes) {
              setSizeError(`File is larger than ${maxLabel}.`);
              onFileChange(null);
              return;
            }
            setSizeError(null);
            onFileChange(picked);
          }}
        />
      </div>

      {maxLabel && (
        sizeError ? (
          <p role="alert" className="text-xs text-destructive">
            {sizeError}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Maximum file size: {maxLabel}.
          </p>
        )
      )}
    </div>
  );
}
