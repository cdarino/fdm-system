import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RadioCardProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

/**
 * A radio button laid out as a selectable card. The highlight follows the
 * input's own checked state through `has-[:checked]`, so it works both with
 * react-hook-form's `register()` and with controlled `checked`/`onChange`.
 */
export function RadioCard({ label, description, className, disabled, ...inputProps }: RadioCardProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col gap-1 rounded-lg border border-border p-3 transition-colors hover:bg-row-hover',
        'has-[:checked]:border-primary has-[:checked]:bg-sidebar-accent',
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input type="radio" disabled={disabled} className="h-4 w-4 accent-[var(--primary)]" {...inputProps} />
        {label}
      </span>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </label>
  );
}
