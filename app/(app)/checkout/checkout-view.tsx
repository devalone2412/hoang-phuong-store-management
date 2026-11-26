"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BarcodeScanButton } from "@/components/barcode-scanner";
import { ProductThumb } from "@/components/product-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bestPrice } from "@/features/products/pricing";
import type { Product } from "@/features/products/schema";
import { ApiError, api } from "@/lib/api";
import { formatVnd } from "@/lib/money";

type Line = { product: Product; qty: number };

const MAX_QTY = 9999;
const STORAGE_KEY = "hp-checkout-cart";

export function CheckoutView() {
  const qc = useQueryClient();
  const [lines, setLines] = useState<Line[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const restored = useRef(false);

  // Keep the cart across tab switches and reloads (this browser tab only). Storage can be blocked.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setLines(JSON.parse(saved) as Line[]);
    } catch {}
    restored.current = true;
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {}
  }, [lines]);

  /** Add one unit; a product already in the cart is bumped and moved to the top. */
  function add(product: Product) {
    setLines((list) => {
      const existing = list.find((l) => l.product.id === product.id);
      const qty = Math.min(MAX_QTY, (existing?.qty ?? 0) + 1);
      return [{ product, qty }, ...list.filter((l) => l.product.id !== product.id)];
    });
  }

  async function scan(raw: string) {
    const q = raw.trim();
    if (!q) return;
    setBusy((n) => n + 1);
    try {
      // Exact-code endpoint (one DB query); repeat scans of the same code are served from the cache.
      const { product } = await qc.fetchQuery({
        queryKey: ["by-code", q],
        queryFn: ({ signal }) => api<{ product: Product }>(`/api/products/by-code/${encodeURIComponent(q)}`, { signal }),
        staleTime: 60_000,
      });
      add(product);
      navigator.vibrate?.(30);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) toast.error(`Không tìm thấy mã “${q}”`);
      else toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy((n) => n - 1);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = code;
    setCode(""); // cleared at once so the next scan can start straight away
    void scan(q);
  }

  const setQty = (id: string, qty: number) =>
    setLines((list) => list.map((l) => (l.product.id === id ? { ...l, qty: Math.min(MAX_QTY, Math.max(1, qty)) } : l)));
  const remove = (id: string) => setLines((list) => list.filter((l) => l.product.id !== id));

  const priced = lines.map((l) => ({ ...l, price: bestPrice(l.product.retailPrice, l.product.combos, l.qty) }));
  const total = priced.reduce((sum, l) => sum + l.price.total, 0);
  const units = lines.reduce((sum, l) => sum + l.qty, 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pb-28">
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          ref={inputRef}
          autoFocus
          inputMode="search"
          autoComplete="off"
          placeholder="Quét hoặc nhập mã vạch / SKU, rồi Enter"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-12 flex-1 text-base"
          aria-label="Mã vạch hoặc SKU"
        />
        <BarcodeScanButton className="size-12 shrink-0" onDetected={(c) => void scan(c)} />
      </form>

      {lines.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">{busy ? "Đang tìm…" : "Chưa có sản phẩm nào. Quét mã vạch để bắt đầu."}</p>
      )}

      <ul className="grid gap-2">
        {priced.map(({ product: p, qty, price }) => {
          const savings = p.retailPrice * qty - price.total;
          return (
            <li key={p.id} className="flex gap-3 rounded-lg border bg-card p-3">
              <ProductThumb product={p} className="size-16" />
              <div className="grid min-w-0 flex-1 gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium [overflow-wrap:anywhere]">{p.name}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {formatVnd(p.retailPrice)} / {p.unit}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{formatVnd(price.total)}</p>
                </div>
                {price.parts.some((x) => x.kind === "combo") && (
                  <p className="text-xs text-primary [overflow-wrap:anywhere]">
                    {price.parts
                      .map((x) => (x.kind === "combo" ? `${x.count} × combo ${x.quantity} (${formatVnd(x.price)})` : `${x.count} × ${formatVnd(x.price)}`))
                      .join(" + ")}
                    {savings > 0 && ` · tiết kiệm ${formatVnd(savings)}`}
                  </p>
                )}
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" aria-label={`Giảm ${p.name}`} disabled={qty <= 1} onClick={() => setQty(p.id, qty - 1)}>
                    <Minus />
                  </Button>
                  <QtyInput value={qty} label={`Số lượng ${p.name}`} onCommit={(n) => setQty(p.id, n)} />
                  <Button type="button" variant="outline" size="icon" aria-label={`Tăng ${p.name}`} onClick={() => setQty(p.id, qty + 1)}>
                    <Plus />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="ml-auto text-destructive" aria-label={`Xóa ${p.name}`} onClick={() => remove(p.id)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">
              {lines.length} loại · {units} sản phẩm
            </p>
            <p className="text-2xl font-bold tabular-nums" aria-live="polite" data-testid="checkout-total">
              {formatVnd(total)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={lines.length === 0}
            onClick={() => {
              if (window.confirm("Xóa toàn bộ đơn hiện tại?")) {
                setLines([]);
                inputRef.current?.focus();
              }
            }}
          >
            Đơn mới
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Number box that lets you clear it while typing; commits only valid whole numbers. */
function QtyInput({ value, label, onCommit }: { value: number; label: string; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <Input
      className="w-16 text-center tabular-nums"
      inputMode="numeric"
      aria-label={label}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, "");
        setText(t);
        if (t && Number(t) >= 1) onCommit(Number(t));
      }}
      onBlur={() => setText(String(value))}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}
