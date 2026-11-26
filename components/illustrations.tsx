import { cn } from "@/lib/utils";

// One drawing language for every illustration: 2.5px rounded strokes, jade for structure, the
// price-tag yellow for the one thing that matters. Colours come from theme tokens so dark mode works.

function Svg({ className, children, viewBox = "0 0 160 120" }: { className?: string; children: React.ReactNode; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} fill="none" className={cn("h-28 w-auto", className)} aria-hidden="true">
      {children}
    </svg>
  );
}

/** A price tag, tilted: the recurring motif. Drawn at the origin; position it with a transform. */
function Tag({ tilt = 0, label }: { tilt?: number; label?: string }) {
  return (
    <g transform={`rotate(${tilt})`}>
      <path d="M-14-16h28a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4h-28a4 4 0 0 1-4-4v-28a4 4 0 0 1 4-4Z" className="fill-price-tag" />
      <circle cx="0" cy="-8" r="2.8" className="fill-background" />
      {label ? (
        <text x="0" y="10" textAnchor="middle" fontSize="10" fontWeight="700" className="fill-price-tag-foreground">
          {label}
        </text>
      ) : (
        <path d="M-8 6h16M-8 12h10" className="stroke-price-tag-foreground/60" strokeWidth="2" strokeLinecap="round" />
      )}
    </g>
  );
}

/**
 * Login hero. It sits on the fixed deep-jade brand panel in both themes, so its colours are fixed too.
 * The yellow tag on the awning swings once when the page loads (see .tag-swing in globals.css).
 */
export function StorefrontArt({ className }: { className?: string }) {
  const stripes = Array.from({ length: 6 }, (_, i) => i);
  return (
    <Svg viewBox="0 0 200 140" className={cn("h-auto w-full", className)}>
      <path d="M8 128h184" stroke="#3fbf9a" strokeOpacity=".35" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="24" y="54" width="152" height="74" rx="4" fill="#0e6b55" />
      {/* door */}
      <rect x="40" y="78" width="38" height="50" rx="3" fill="#f7f8f6" />
      <circle cx="71" cy="104" r="2.2" fill="#0e6b55" />
      {/* window with shelf */}
      <rect x="96" y="74" width="64" height="40" rx="3" fill="#0a4d3d" stroke="#3fbf9a" strokeOpacity=".5" strokeWidth="2" />
      <path d="M96 98h64" stroke="#3fbf9a" strokeOpacity=".5" strokeWidth="2" />
      <rect x="104" y="84" width="8" height="14" rx="2" fill="#f7f8f6" />
      <rect x="116" y="88" width="10" height="10" rx="2" fill="#f4b400" />
      <rect x="130" y="82" width="8" height="16" rx="2" fill="#3fbf9a" />
      <rect x="142" y="88" width="10" height="10" rx="2" fill="#f7f8f6" />
      <rect x="104" y="104" width="12" height="6" rx="2" fill="#3fbf9a" />
      <rect x="122" y="104" width="12" height="6" rx="2" fill="#f4b400" />
      {/* awning: alternating stripes with scalloped edge */}
      {stripes.map((i) => {
        const tx = 32 + i * 22.67;
        const bx = 20 + i * 26.67;
        const fill = i % 2 ? "#3fbf9a" : "#f7f8f6";
        return (
          <g key={i} fill={fill}>
            <path d={`M${tx} 28h22.67L${bx + 26.67} 56H${bx}Z`} />
            <path d={`M${bx} 55.5a13.33 13.33 0 0 0 26.67 0Z`} />
          </g>
        );
      })}
      {/* the tag */}
      <g className="tag-swing" style={{ transformOrigin: "150px 70px" }}>
        <path d="M150 70v8" stroke="#f7f8f6" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="136" y="78" width="28" height="30" rx="4" fill="#f4b400" />
        <circle cx="150" cy="84" r="2.4" fill="#0a4d3d" />
        <text x="150" y="101" textAnchor="middle" fontSize="11" fontWeight="700" fill="#17201d">
          15k
        </text>
      </g>
    </Svg>
  );
}

/** Empty product list: an open box with a price tag waiting to be used. */
export function EmptyBoxArt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <ellipse cx="80" cy="108" rx="46" ry="6" className="fill-foreground/10" />
      <g transform="translate(86 34)">
        <Tag tilt={12} />
      </g>
      <path d="M40 58 28 42h40l4 16Zm80 0 12-16H92l-4 16Z" className="fill-card stroke-primary" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="40" y="58" width="80" height="46" rx="5" className="fill-accent stroke-primary" strokeWidth="2.5" />
      <path d="M72 58h16v18l-8-5-8 5Z" className="fill-primary/25" />
    </Svg>
  );
}

/** Empty checkout: a barcode label with the scan line crossing it. */
export function ScanArt({ className }: { className?: string }) {
  const bars: [number, number][] = [[44, 4], [52, 2], [58, 6], [68, 2], [74, 4], [82, 2], [88, 6], [98, 3], [105, 2], [111, 4]];
  return (
    <Svg className={className}>
      <rect x="30" y="22" width="100" height="70" rx="8" className="fill-card stroke-border" strokeWidth="2.5" />
      {bars.map(([x, w]) => (
        <rect key={x} x={x} y="34" width={w} height="34" rx="1" className="fill-foreground/80" />
      ))}
      <path d="M44 78h30M82 78h12" className="stroke-muted-foreground/50" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 57h120" className="stroke-destructive" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 57h120" className="stroke-destructive/25" strokeWidth="9" strokeLinecap="round" />
      <path d="M22 34V26a6 6 0 0 1 6-6h8M138 34V26a6 6 0 0 0-6-6h-8M22 80v8a6 6 0 0 0 6 6h8M138 80v8a6 6 0 0 1-6 6h-8" className="stroke-primary" strokeWidth="3.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Nothing typed yet, or nothing found: a magnifier over a price tag. */
export function SearchArt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <ellipse cx="80" cy="108" rx="40" ry="5" className="fill-foreground/10" />
      <g transform="translate(108 36)">
        <Tag tilt={-14} label="?" />
      </g>
      <circle cx="68" cy="58" r="28" className="fill-card/70 stroke-primary" strokeWidth="5" />
      <path d="M50 46a22 22 0 0 1 14-9" className="stroke-primary/40" strokeWidth="3" strokeLinecap="round" />
      <path d="m88 80 20 20" className="stroke-primary" strokeWidth="9" strokeLinecap="round" />
    </Svg>
  );
}
