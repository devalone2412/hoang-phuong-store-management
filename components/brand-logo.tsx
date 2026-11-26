import { cn } from "@/lib/utils";

/**
 * The "HP" mark: a shelf price tag (clipped corner, punched hole). Same artwork as app/icon.svg.
 * `inverse` is for dark panels, where the tag is paper-coloured instead of jade.
 */
export function BrandLogo({ className, withWordmark = false, inverse = false }: { className?: string; withWordmark?: boolean; inverse?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-bold tracking-tight", className)}>
      <svg viewBox="0 0 64 64" fill="none" className="size-8 shrink-0" aria-hidden="true">
        <path d="M14 2h30l18 18v30a12 12 0 0 1-12 12H14A12 12 0 0 1 2 50V14A12 12 0 0 1 14 2Z" className={inverse ? "fill-white" : "fill-primary"} />
        <circle cx="49" cy="15" r="4.5" className="fill-price-tag" />
        <g className={inverse ? "stroke-brand-deep" : "stroke-primary-foreground"} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 24v26M28 24v26M14 37h14" />
          <path d="M36 50V24h6a6.5 6.5 0 0 1 0 13h-6" />
        </g>
      </svg>
      {withWordmark && <span>Hoàng Phương</span>}
    </span>
  );
}
