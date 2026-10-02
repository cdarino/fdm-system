import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const iconBoxVariants = cva(
  "flex shrink-0 items-center justify-center bg-row-hover ring-1 ring-inset ring-border text-muted-foreground",
  {
    variants: {
      size: {
        default: "h-8 w-8 text-sm",
        sm: "h-7 w-7 text-xs",
        md: "h-9 w-9 text-sm",
        lg: "h-11 w-11 text-base",
      },
      shape: {
        circle: "rounded-full",
        square: "rounded-lg",
        "rounded-md": "rounded-md",
        "rounded-xl": "rounded-xl",
      },
    },
    defaultVariants: {
      size: "default",
      shape: "square",
    },
  },
);

export interface IconBoxProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconBoxVariants> {}

const IconBox = React.forwardRef<HTMLDivElement, IconBoxProps>(
  ({ className, size, shape, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(iconBoxVariants({ size, shape, className }))}
      {...props}
    />
  ),
);
IconBox.displayName = "IconBox";

export { IconBox, iconBoxVariants };
