import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Encapsulates base border, surface, and elevation tokens across card archetypes.
const cardVariants = cva(
  "rounded-xl border bg-card text-card-foreground shadow",
  {
    variants: {
      variant: {
        default: "",
        section: "flex flex-1 flex-col overflow-hidden",
        interactive: "transition-shadow hover:shadow-md cursor-pointer",
        prominent: "rounded-2xl shadow-lg",
        dashed:
          "border-2 border-dashed hover:border-primary transition-colors flex items-center justify-center",
      },
      padding: {
        none: "",
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

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
  cardTitleVariants,
};
