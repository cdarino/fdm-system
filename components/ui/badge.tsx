import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const dotVariants = {
  default: "bg-primary-foreground",
  secondary: "bg-secondary-foreground",
  outline: "bg-foreground",
  success: "bg-success",
  warning: "bg-row-accent",
  info: "bg-primary",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
} as const;

const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-[color-mix(in_srgb,var(--secondary)_80%,black)]",
        outline: "border-border text-foreground",
        success:
          "border-transparent bg-[color-mix(in_srgb,var(--success)_12%,white)] text-success",
        warning:
          "border-transparent bg-row-active text-accent-gold-foreground",
        info:
          "border-transparent bg-sidebar-accent text-accent-blue-foreground",
        destructive:
          "border-transparent bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
      shape: {
        default: "rounded-md",
        pill: "rounded-full font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({
  className,
  variant = "default",
  shape,
  dot,
  children,
  ...props
}: BadgeProps) {
  const dotColorClass = dotVariants[variant ?? "default"] ?? "bg-current";

  return (
    <div
      className={cn(badgeVariants({ variant, shape, className }))}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColorClass)}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
