'use client';

import { useEffect, useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilePickerProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
  buttonLabel?: string;
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
  disabled,
  className,
  buttonLabel = 'Choose file',
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Clearing the file from outside also clears the hidden input, so choosing
  // the same file again still fires a change.
  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = '';
  }, [file]);

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
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

      <span className={cn('min-w-0 flex-1 truncate text-sm', file ? 'text-foreground' : 'text-muted-foreground')}>
        {file ? file.name : 'No file chosen'}
      </span>

      {file && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => onFileChange(null)}
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
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
