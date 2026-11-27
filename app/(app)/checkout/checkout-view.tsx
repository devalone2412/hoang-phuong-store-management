"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, PlusCircle, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ScanArt } from "@/components/illustrations";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BarcodeScanButton } from "@/components/barcode-scanner";
import { ProductThumb } from "@/components/product-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bestPrice, under1kgPrice, weightPrice, weightRate } from "@/features/products/pricing";
import type { Product } from "@/features/products/schema";
import { ApiError, api } from "@/lib/api";
import { formatVnd } from "@/lib/money";
import { formatWeight } from "@/lib/weight";
import { WeightInput } from "@/components/weight-input";
import { ExtraForm } from "./extra-form";

const SUGGEST_SIZE = 8;

/** Weighed products carry `grams` (null until the cashier enters it); the rest carry `qty`. */
type Line = { product: Product; qty: number; grams?: number | null };

/** An amount typed in by hand for something that isn't a stored product. */
type Extra = { id: string; name: string; amount: number; qty: number };

const MAX_QTY = 9999;
const STORAGE_KEY = "hp-checkout-cart";
const EXTRAS_KEY = "hp-checkout-extras";

export function CheckoutView() {
  const qc = useQueryClient();
  const [lines, setLines] = useState<Line[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [extraOpen, setExtraOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const restored = useRef(false);
  // The weighed line that was just added: its weight box takes focus so the cashier can type the weight.
  const [focusId, setFocusId] = useState<string | null>(null);

  // Name search: suggestions for what is being typed; tapping one adds it to the cart.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(code.trim()), 200);
    return () => clearTimeout(t);
  }, [code]);
  const query = code.trim() ? debounced : "";
  const { data: suggest } = useQuery({
    queryKey: ["lookup", query, "checkout"],
    queryFn: ({ signal }) => api<{ items: Product[] }>(`/api/lookup?q=${encodeURIComponent(query)}&pageSize=${SUGGEST_SIZE}`, { signal }),
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
  });
  const suggestions = query.length >= 2 ? (suggest?.items ?? []) : [];

  // Keep the cart across tab switches and reloads (this browser tab only). Storage can be blocked.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setLines(JSON.parse(saved) as Line[]);
      const savedExtras = sessionStorage.getItem(EXTRAS_KEY);
      if (savedExtras) setExtras(JSON.parse(savedExtras) as Extra[]);
    } catch {}
    restored.current = true;
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {}
  }, [lines]);
  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
    } catch {}
  }, [extras]);

  /**
   * Add one unit; a product already in the cart is bumped and moved to the top. A weighed product is
   * added once (its amount is a weight, not a count) and returns true so the caller leaves focus to
   * its weight box.
   */
  function add(product: Product): boolean {
    const weighed = product.soldByWeight === true;
    setLines((list) => {
      const existing = list.find((l) => l.product.id === product.id);
      const rest = list.filter((l) => l.product.id !== product.id);
      if (weighed) return [{ product, qty: 1, grams: existing?.grams ?? null }, ...rest];
      const qty = Math.min(MAX_QTY, (existing?.qty ?? 0) + 1);
      return [{ product, qty }, ...rest];
    });
    if (weighed) setFocusId(product.id);
    return weighed;
  }

  async function scan(raw: string) {
    const q = raw.trim();
    if (!q) return;
    setBusy((n) => n + 1);
    let weighed = false;
    try {
      // Exact-code endpoint (one DB query); repeat scans of the same code are served from the cache.
      const { product } = await qc.fetchQuery({
        queryKey: ["by-code", q],
        queryFn: ({ signal }) => api<{ product: Product }>(`/api/products/by-code/${encodeURIComponent(q)}`, { signal }),
        staleTime: 60_000,
      });
      weighed = add(product);
      navigator.vibrate?.(30);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) toast.error(`Không tìm thấy mã “${q}”`);
      else toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy((n) => n - 1);
      if (!weighed) inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = code;
    setCode(""); // cleared at once so the next scan can start straight away
    void scan(q);
  }

  function pick(p: Product) {
    const weighed = add(p);
    navigator.vibrate?.(30);
    setCode("");
    setDebounced("");
    if (!weighed) inputRef.current?.focus();
  }

  const setQty = (id: string, qty: number) =>
    setLines((list) => list.map((l) => (l.product.id === id ? { ...l, qty: Math.min(MAX_QTY, Math.max(1, qty)) } : l)));
  const setGrams = (id: string, grams: number | null) => setLines((list) => list.map((l) => (l.product.id === id ? { ...l, grams } : l)));
  const remove = (id: string) => setLines((list) => list.filter((l) => l.product.id !== id));

  const priced = lines.map((l) => ({
    ...l,
    weighed: l.product.soldByWeight === true,
    price: l.product.soldByWeight ? { total: l.grams ? weightPrice(l.product, l.grams) : 0, parts: [] } : bestPrice(l.product.retailPrice, l.product.combos, l.qty),
  }));
  const total = priced.reduce((sum, l) => sum + l.price.total, 0) + extras.reduce((sum, x) => sum + x.amount * x.qty, 0);
  const units = priced.reduce((sum, l) => sum + (l.weighed ? 0 : l.qty), 0) + extras.reduce((sum, x) => sum + x.qty, 0);
  const setExtraQty = (id: string, qty: number) =>
    setExtras((list) => list.map((x) => (x.id === id ? { ...x, qty: Math.min(MAX_QTY, Math.max(1, qty)) } : x)));
  const removeExtra = (id: string) => setExtras((list) => list.filter((x) => x.id !== id));
  const totalGrams = priced.reduce((sum, l) => sum + (l.weighed ? (l.grams ?? 0) : 0), 0);
  const unweighed = priced.filter((l) => l.weighed && !l.grams).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pb-28">
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          ref={inputRef}
          autoFocus
          inputMode="search"
          autoComplete="off"
          placeholder="Quét mã, nhập SKU hoặc tìm theo tên sản phẩm"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-12 flex-1 text-base"
          aria-label="Mã vạch, SKU hoặc tên sản phẩm"
        />
        <BarcodeScanButton className="size-12 shrink-0" onDetected={(c) => void scan(c)} />
      </form>

      {extraOpen ? (
        <ExtraForm
          onAdd={(name, amount) => {
            setExtras((list) => [{ id: crypto.randomUUID(), name, amount, qty: 1 }, ...list]);
            setExtraOpen(false);
            inputRef.current?.focus();
          }}
          onClose={() => setExtraOpen(false)}
        />
      ) : (
        <Button type="button" variant="outline" className="h-11 justify-self-start" onClick={() => setExtraOpen(true)}>
          <PlusCircle />
          Thêm khoản khác
        </Button>
      )}

      {suggestions.length > 0 && (
        <ul className="grid gap-1 rounded-lg border bg-card p-1" aria-label="Gợi ý sản phẩm">
          {suggestions.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => pick(p)} className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-accent">
                <ProductThumb product={p} className="size-10" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium [overflow-wrap:anywhere]">{p.name}</span>
                  <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{[p.sku, p.unit].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                  {formatVnd(p.retailPrice)}
                  {p.soldByWeight && <span className="font-normal text-muted-foreground"> / kg</span>}
                  {p.soldByWeight && (
                    <span className="block text-xs font-normal text-muted-foreground">{formatVnd(under1kgPrice(p))} / 100 g</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {lines.length === 0 && extras.length === 0 && !extraOpen && (
        <EmptyState art={<ScanArt />} title={busy ? "Đang tìm…" : "Chưa có sản phẩm nào."} className="py-10">
          {busy ? null : "Quét mã vạch hoặc gõ tên ở ô trên để thêm vào đơn."}
        </EmptyState>
      )}

      <ul className="grid gap-2">
        {priced.map(({ product: p, qty, grams, price, weighed }) => {
          if (weighed) {
            const rate = grams ? weightRate(p, grams) : null;
            const exact = rate?.exact ?? 0;
            // Under 1 kg at the 100 g price can cost as much as a whole kg: tell the cashier.
            const fullKg = weightPrice(p, 1000);
            const kgIsCheaper = grams != null && grams < 1000 && price.total > fullKg;
            return (
              <li key={p.id} className="flex gap-3 rounded-lg border bg-card p-3">
                <ProductThumb product={p} className="size-16" />
                <div className="grid min-w-0 flex-1 gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium [overflow-wrap:anywhere]">{p.name}</p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {rate
                          ? rate.per === "100g"
                            ? `${formatVnd(rate.price)} / 100 g · dưới 1 kg`
                            : `${formatVnd(rate.price)} / kg`
                          : p.price100g != null
                            ? `${formatVnd(p.retailPrice)} / kg · ${formatVnd(p.price100g)} / 100 g`
                            : `${formatVnd(p.retailPrice)} / kg`}
                      </p>
                    </div>
                    {grams ? (
                      <p className="shrink-0 font-semibold tabular-nums">{formatVnd(price.total)}</p>
                    ) : (
                      <p className="shrink-0 text-sm font-medium text-amber-600">Chưa nhập cân</p>
                    )}
                  </div>
                  {grams ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatWeight(grams)}
                      {Math.round(exact) !== price.total && ` · làm tròn đến 500 ₫ (${formatVnd(Math.round(exact))})`}
                    </p>
                  ) : null}
                  {kgIsCheaper && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-amber-600">
                      <span>Lấy đủ 1 kg chỉ {formatVnd(fullKg)}</span>
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setGrams(p.id, 1000)}>
                        Lấy 1 kg
                      </Button>
                    </div>
                  )}
                  <div className="flex items-start gap-1">
                    <WeightInput
                      className="min-w-0 flex-1"
                      label={`Số cân ${p.name}`}
                      grams={grams ?? null}
                      onChange={(g) => setGrams(p.id, g)}
                      autoFocus={focusId === p.id}
                    />
                    <Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label={`Xóa ${p.name}`} onClick={() => remove(p.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            );
          }
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

      {extras.length > 0 && (
        <ul className="grid gap-2" aria-label="Khoản khác">
          {extras.map((x) => (
            <li key={x.id} className="grid gap-2 rounded-lg border border-dashed bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium [overflow-wrap:anywhere]">{x.name}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">{formatVnd(x.amount)}</p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">{formatVnd(x.amount * x.qty)}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="icon" aria-label={`Giảm ${x.name}`} disabled={x.qty <= 1} onClick={() => setExtraQty(x.id, x.qty - 1)}>
                  <Minus />
                </Button>
                <QtyInput value={x.qty} label={`Số lượng ${x.name}`} onCommit={(n) => setExtraQty(x.id, n)} />
                <Button type="button" variant="outline" size="icon" aria-label={`Tăng ${x.name}`} onClick={() => setExtraQty(x.id, x.qty + 1)}>
                  <Plus />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="ml-auto text-destructive" aria-label={`Xóa ${x.name}`} onClick={() => removeExtra(x.id)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">
              {lines.length + extras.length} loại
              {units > 0 && ` · ${units} sản phẩm`}
              {totalGrams > 0 && ` · ${formatWeight(totalGrams)}`}
              {unweighed > 0 && <span className="text-amber-600"> · {unweighed} món chưa cân</span>}
            </p>
            <p className="text-2xl font-bold tabular-nums" aria-live="polite" data-testid="checkout-total">
              {formatVnd(total)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={lines.length === 0 && extras.length === 0}
            onClick={() => {
              if (window.confirm("Xóa toàn bộ đơn hiện tại?")) {
                setLines([]);
                setExtras([]);
                setExtraOpen(false);
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
