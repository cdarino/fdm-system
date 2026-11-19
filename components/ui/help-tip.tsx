"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTipProps {
  text: string;
  title?: string;
  className?: string;
}

export function HelpTip({ text, title, className }: HelpTipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={-1}
            aria-label={title || "Help info"}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center justify-center ml-1 w-3.5 h-3.5 rounded-full border border-border bg-muted text-[10px] font-bold text-muted-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-colors cursor-help align-middle print:hidden select-none shrink-0",
              className
            )}
          >
            ?
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="w-60 p-2.5 space-y-1">
          {title && (
            <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              {title}
            </div>
          )}
          <div className="text-muted-foreground text-xs leading-relaxed">{text}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default HelpTip;
