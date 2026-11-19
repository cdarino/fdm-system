import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  allowNegative?: boolean;
  allowDecimals?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      allowNegative,
      allowDecimals,
      onKeyDown,
      onPaste,
      onWheel,
      inputMode,
      ...props
    },
    ref,
  ) => {
    const isStepInteger = props.step === 1 || props.step === "1";
    const canHaveDecimals = allowDecimals ?? !isStepInteger;
    const canHaveNegative =
      allowNegative ?? (props.min !== undefined ? Number(props.min) < 0 : false);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (type === "number") {
        if (
          e.ctrlKey ||
          e.metaKey ||
          e.altKey ||
          [
            "Backspace",
            "Delete",
            "Tab",
            "Enter",
            "Escape",
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Home",
            "End",
            "PageUp",
            "PageDown",
          ].includes(e.key) ||
          /^F\d+$/.test(e.key)
        ) {
          onKeyDown?.(e);
          return;
        }

        if (/^[0-9]$/.test(e.key)) {
          onKeyDown?.(e);
          return;
        }

        if (e.key === "." || e.key === "Decimal") {
          if (!canHaveDecimals) {
            e.preventDefault();
            return;
          }
          const target = e.currentTarget;
          const val = target.value;
          const selStart = target.selectionStart ?? 0;
          const selEnd = target.selectionEnd ?? 0;
          const selectedText = val.slice(selStart, selEnd);
          if (val.includes(".") && !selectedText.includes(".")) {
            e.preventDefault();
            return;
          }
          onKeyDown?.(e);
          return;
        }

        if (e.key === "-") {
          if (!canHaveNegative) {
            e.preventDefault();
            return;
          }
          const target = e.currentTarget;
          const val = target.value;
          const selStart = target.selectionStart ?? 0;
          if (selStart !== 0 || val.includes("-")) {
            e.preventDefault();
            return;
          }
          onKeyDown?.(e);
          return;
        }

        // Prevent exponential notation, explicit plus, letters, symbols, and spaces
        e.preventDefault();
        return;
      }

      onKeyDown?.(e);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (type === "number") {
        const rawPasted = e.clipboardData.getData("text");
        const cleaned = rawPasted.replace(/,/g, "").trim();
        const decimalPattern = canHaveDecimals ? "(\\.\\d+)?" : "";
        const signPattern = canHaveNegative ? "-?" : "";
        const numRegex = new RegExp(`^${signPattern}\\d+${decimalPattern}$`);

        if (!numRegex.test(cleaned)) {
          e.preventDefault();
          return;
        }

        if (cleaned !== rawPasted) {
          e.preventDefault();
          const target = e.currentTarget;
          const selStart = target.selectionStart ?? 0;
          const selEnd = target.selectionEnd ?? 0;
          const currentVal = target.value;
          const nextVal = currentVal.slice(0, selStart) + cleaned + currentVal.slice(selEnd);

          if (!numRegex.test(nextVal)) {
            return;
          }

          // Trigger input change event for React state handlers
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          )?.set;
          if (nativeSetter) {
            nativeSetter.call(target, nextVal);
            target.dispatchEvent(new Event("input", { bubbles: true }));
          }
          return;
        }
      }

      onPaste?.(e);
    };

    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (type === "number") {
        // Prevent accidental value changes when scrolling past the field
        e.currentTarget.blur();
      }
      onWheel?.(e);
    };

    const computedInputMode =
      inputMode ?? (type === "number" ? (canHaveDecimals ? "decimal" : "numeric") : undefined);

    return (
      <input
        type={type}
        inputMode={computedInputMode}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onWheel={handleWheel}
        className={cn(
          "flex h-9 w-full min-w-0 max-w-full rounded-md border border-input bg-card px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
