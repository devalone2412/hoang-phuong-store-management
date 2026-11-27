"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_GRAMS, formatWeight, parseWeight, weightInputText } from "@/lib/weight";
import { cn } from "@/lib/utils";

const CHIPS = [100, 200, 500, 1000] as const;
const STEP = 100;

type Props = {
  /** Weight in whole grams, or null while nothing valid is typed. */
  grams: number | null;
  onChange: (grams: number | null) => void;
  label: string;
  className?: string;
  autoFocus?: boolean;
  /** Smaller chips and no −/+ buttons, for tight spots (the Tra giá calculator). */
  compact?: boolean;
};

/**
 * Weight box for phones: type "1,2kg", "100g" or "300", tap a chip (100g · 200g · 500g · 1kg), or step
 * by 100 g. A yellow tag says how the text was read (a bare "1,2" is 1,2 kg, a bare "300" is 300 g).
 */
export function WeightInput({ grams, onChange, label, className, autoFocus, compact }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(weightInputText(grams));
  const parsed = parseWeight(text);
  const typed = parsed != null && !Number.isNaN(parsed) ? parsed : null;

  // Follow outside changes (cart restored, another control) but never fight what is being typed.
  useEffect(() => {
    if (grams !== typed) setText(weightInputText(grams));
    // Only when `grams` changes: `typed` is derived from the text this effect would overwrite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grams]);

  const set = (g: number | null) => {
    setText(weightInputText(g));
    onChange(g);
  };
  const invalid = parsed !== null && Number.isNaN(parsed) && text.trim() !== "";
  const preview = typed != null && text.trim() !== weightInputText(typed) ? formatWeight(typed) : null;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-center gap-1">
        {!compact && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Giảm ${STEP} g – ${label}`}
            disabled={typed == null || typed <= STEP}
            onClick={() => set(Math.max(STEP, (typed ?? 0) - STEP))}
          >
            <Minus />
          </Button>
        )}
        <div className="relative min-w-0 flex-1">
          <Input
            ref={ref}
            autoFocus={autoFocus}
            inputMode="decimal"
            autoComplete="off"
            placeholder="vd 1,2kg hoặc 100g"
            aria-label={label}
            aria-invalid={invalid || undefined}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const g = parseWeight(e.target.value);
              onChange(g != null && !Number.isNaN(g) ? g : null);
            }}
            onBlur={() => {
              if (typed != null) setText(weightInputText(typed));
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 text-right text-base font-semibold tabular-nums"
          />
        </div>
        {!compact && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Tăng ${STEP} g – ${label}`}
            disabled={(typed ?? 0) + STEP > MAX_GRAMS}
            onClick={() => set(Math.min(MAX_GRAMS, (typed ?? 0) + STEP))}
          >
            <Plus />
          </Button>
        )}
      </div>
      <div className="flex w-full rounded-lg bg-muted p-0.5">
        {CHIPS.map((g) => (
          <button
            key={g}
            type="button"
            aria-label={`${formatWeight(g)} – ${label}`}
            aria-pressed={typed === g}
            // Keep focus (and the on-screen keyboard) where it is.
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => set(g)}
            className={cn(
              "h-8 flex-1 rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground active:bg-card active:text-foreground active:shadow-sm",
              typed === g && "bg-card text-foreground shadow-sm",
            )}
          >
            {g === 1000 ? "1kg" : `${g}g`}
          </button>
        ))}
      </div>
      <p className="min-h-5 text-xs" aria-live="polite">
        {invalid ? (
          <span className="text-destructive">Nhập số cân, vd 1,2kg hoặc 100g (tối đa 999 kg)</span>
        ) : (
          preview && <span className="inline-block rounded bg-price-tag/25 px-1.5 py-0.5 font-semibold leading-none text-foreground">= {preview}</span>
        )}
      </p>
    </div>
  );
}
