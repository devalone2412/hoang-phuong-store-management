import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Props = ComponentProps<"select"> & {
  /** Layout classes for the wrapper (width, flex, grid placement). */
  className?: string;
  /** Overrides for the select itself (height, text size). */
  selectClassName?: string;
};

/**
 * A native <select> (reliable in installed PWAs on iOS and Android) with its own chevron: browsers
 * draw the built-in arrow hard against the right border, so it is hidden and redrawn with padding.
 */
export function NativeSelect({ className, selectClassName, children, ...props }: Props) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        {...props}
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-input bg-background py-1 pr-9 pl-3 text-base text-foreground shadow-xs outline-none md:text-sm",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          selectClassName,
        )}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
