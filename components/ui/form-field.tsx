import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

interface FormFieldProps extends ComponentProps<typeof Input> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  labelClassName?: string;
}

export function FormField({ id, label, hint, error, labelClassName, className, ...inputProps }: FormFieldProps) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={cn('text-foreground font-medium text-sm', labelClassName)}>
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionId}
        className={cn(
          'bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring rounded-lg',
          error && 'border-destructive focus:border-destructive focus:ring-destructive',
          className
        )}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
