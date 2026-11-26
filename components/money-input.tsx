"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { applyVndSuffix, formatVnd, formatVndNumber, parseVnd } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
};

const CHIPS = [
  { suffix: "k", label: "k", aria: "Nhân nghìn" },
  { suffix: "tr", label: "tr", aria: "Nhân triệu" },
  { suffix: "000", label: "000", aria: "Thêm 000" },
] as const;

/**
 * Price box for phones. The numeric keypad has no letters, so k / tr / 000 are buttons in a strip
 * under the box, and a small yellow tag says what the text means (15k = 15.000 ₫).
 * Figures are right-aligned like a till display; leaving the box tidies "20k" into "20.000".
 */
export function MoneyInput({ id, value, onChange, placeholder, className, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const parsed = parseVnd(value);
  const valid = parsed !== null && !Number.isNaN(parsed);
  // Only worth showing when the text isn't already the plain number.
  const preview = valid && value.trim() !== formatVndNumber(parsed) ? formatVnd(parsed) : null;

  return (
    <div data-money-field className={cn("grid gap-1.5", className)}>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          inputMode="decimal"
          placeholder={placeholder}
          aria-label={rest["aria-label"]}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (valid) onChange(formatVndNumber(parsed));
          }}
          className="h-11 pl-3 pr-8 text-right text-base font-semibold tabular-nums"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground" aria-hidden="true">
          ₫
        </span>
      </div>
      <div className="flex w-full rounded-lg bg-muted p-0.5">
        {CHIPS.map((c) => (
          <button
            key={c.suffix}
            type="button"
            tabIndex={-1}
            aria-label={c.aria}
            // Keep focus (and the on-screen keyboard) in the input.
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange(applyVndSuffix(value, c.suffix));
              ref.current?.focus();
            }}
            className="h-8 flex-1 rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground active:bg-card active:text-foreground active:shadow-sm"
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="h-5" aria-live="polite">
        {preview && (
          <span className="inline-block rounded bg-price-tag/25 px-1.5 py-0.5 text-xs font-semibold leading-none text-foreground">= {preview}</span>
        )}
      </p>
    </div>
  );
}
