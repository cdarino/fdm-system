import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 text-sm [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-card text-foreground border-border",
        destructive:
          "border-[color-mix(in_srgb,var(--destructive)_30%,white)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive [&>svg]:text-destructive",
        warning:
          "border-[color-mix(in_srgb,var(--row-accent)_35%,white)] bg-[color-mix(in_srgb,var(--row-accent)_15%,white)] text-accent-gold-foreground [&>svg]:text-accent-gold-foreground",
        success:
          "border-[color-mix(in_srgb,var(--success)_30%,white)] bg-[color-mix(in_srgb,var(--success)_10%,white)] text-success [&>svg]:text-success",
        info: "border-border bg-sidebar-accent text-accent-blue-foreground [&>svg]:text-accent-blue-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription, alertVariants };
