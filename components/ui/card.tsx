import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Encapsulates base border, surface, and elevation tokens across card archetypes.
const cardVariants = cva(
  "rounded-xl border bg-card text-card-foreground shadow-sm",
  {
    variants: {
      variant: {
        default: "",
        section: "flex flex-col",
        interactive: "transition-shadow hover:shadow-md cursor-pointer",
        prominent: "rounded-2xl shadow-lg",
        dashed:
          "border-2 border-dashed hover:border-primary transition-colors flex items-center justify-center",
        canvas: "border-border-warm bg-card shadow-xs",
      },
      padding: {
        none: "",
        sm: "p-3",
        default: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "none",
    },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, className }))}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const cardTitleVariants = cva(
  "font-semibold leading-none tracking-tight text-foreground",
  {
    variants: {
      size: {
        default: "text-lg",
        sm: "text-base",
        lg: "text-xl",
        xl: "text-2xl",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export interface CardTitleProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardTitleVariants> {}

const CardTitle = React.forwardRef<HTMLDivElement, CardTitleProps>(
  ({ className, size, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardTitleVariants({ size, className }))}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

const CardToolbar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col gap-3 px-4 pb-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between",
      className,
    )}
    {...props}
  />
));
CardToolbar.displayName = "CardToolbar";

const CardStickyHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "sticky top-0 z-20 bg-card rounded-t-xl border-b border-border shadow-xs",
      className,
    )}
    {...props}
  />
));
CardStickyHeader.displayName = "CardStickyHeader";

export interface CardTableFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {
  sticky?: boolean;
}

const CardTableFooter = React.forwardRef<
  HTMLDivElement,
  CardTableFooterProps
>(({ className, sticky = true, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6",
      sticky && "sticky bottom-0 z-20 bg-card rounded-b-xl shadow-[0_-4px_12px_rgba(0,0,0,0.05)]",
      className,
    )}
    {...props}
  />
));
CardTableFooter.displayName = "CardTableFooter";

const cardScrollContainerVariants = cva(
  "min-h-0 flex-1 overflow-auto border-t border-border",
  {
    variants: {
      padding: {
        none: "",
        sm: "p-3",
        default: "p-4 sm:p-6",
        lg: "p-6 sm:p-8",
      },
    },
    defaultVariants: {
      padding: "none",
    },
  },
);

export interface CardScrollContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardScrollContainerVariants> {}

const CardScrollContainer = React.forwardRef<
  HTMLDivElement,
  CardScrollContainerProps
>(({ className, padding, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardScrollContainerVariants({ padding, className }))}
    {...props}
  />
));
CardScrollContainer.displayName = "CardScrollContainer";

const CardTableBody = CardScrollContainer;

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardToolbar,
  CardStickyHeader,
  CardTableFooter,
  CardScrollContainer,
  CardTableBody,
  cardVariants,
  cardTitleVariants,
  cardScrollContainerVariants,
};
