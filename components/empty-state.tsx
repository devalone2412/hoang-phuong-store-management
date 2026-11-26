import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Illustration + what happened + what to do next. Left-aligned copy is for forms; empty states centre. */
export function EmptyState({ art, title, children, className }: { art: ReactNode; title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto flex max-w-xs flex-col items-center py-8 text-center", className)}>
      {art}
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      {children && <p className="mt-1 text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}
