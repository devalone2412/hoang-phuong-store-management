"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BarcodeScanButton } from "@/components/barcode-scanner";
import { EmptyState } from "@/components/empty-state";
import { SearchArt } from "@/components/illustrations";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/native-select";
import { Input } from "@/components/ui/input";
import { WeightInput } from "@/components/weight-input";
import { weightPrice, weightRate } from "@/features/products/pricing";
import { api } from "@/lib/api";
import { formatVnd } from "@/lib/money";
import { PriceList, ProductThumb } from "@/components/product-bits";
import type { Product } from "@/features/products/schema";

type LookupResult = { exact: Product | null; items: Product[]; total: number; page: number; pageSize: number };
const PAGE_SIZE = 20;

const fetchLookup = (q: string, category: string, page: number, signal?: AbortSignal) =>
  api<LookupResult>(`/api/lookup?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&page=${page}&pageSize=${PAGE_SIZE}`, { signal });

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function LookupView() {
  const [q, setQ] = useState("");
  // Text typed before hydration finished (the box autofocuses) is in the DOM but not in state.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const typed = searchRef.current?.value;
    if (typed) setQ(typed);
  }, []);
  const debounced = useDebounced(q.trim(), 200);
  const [category, setCategory] = useState("");
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => api<{ items: { id: string; name: string }[] }>("/api/categories", { signal }),
    staleTime: 5 * 60_000,
  });
  const categoryNames = categories.data?.items.map((c) => c.name);
  // A group that was renamed or deleted meanwhile can't stay selected.
  useEffect(() => {
    if (category && categoryNames && !categoryNames.includes(category)) setCategory("");
  }, [category, categoryNames]);

  // Searching or browsing a group: either one is enough to list products.
  const active = debounced.length > 0 || category !== "";
  const searchKey = `${debounced}\u0000${category}`;
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  // A new query always starts on page 1 (derived, so there is no render with a stale page).
  const page = pageState.key === searchKey ? pageState.page : 1;
  const qc = useQueryClient();
  const { data, isFetching } = useQuery({
    queryKey: ["lookup", debounced, page, category],
    queryFn: ({ signal }) => fetchLookup(debounced, category, page, signal),
    enabled: active,
    placeholderData: keepPreviousData,
  });

  // Warm the next page so "Sau" feels instant.
  const hasNext = !!data && page * PAGE_SIZE < data.total;
  useEffect(() => {
    if (active && hasNext) void qc.prefetchQuery({ queryKey: ["lookup", debounced, page + 1, category], queryFn: ({ signal }) => fetchLookup(debounced, category, page + 1, signal) });
  }, [qc, active, debounced, category, page, hasNext]);

  const items = active ? (data?.items ?? []) : [];
  const exact = debounced ? data?.exact : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* Password managers (e.g. NordPass) inject elements next to inputs before hydration. */}
      <div className="flex gap-2" suppressHydrationWarning>
        <Input
          ref={searchRef}
          autoFocus
          type="search"
          autoComplete="off"
          data-np-ignore="true"
          data-lpignore="true"
          data-1p-ignore
          data-form-type="other"
          inputMode="search"
          placeholder="Tên, mã SKU hoặc quét mã vạch…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-12 flex-1 text-base"
          aria-label="Tìm sản phẩm"
        />
        <BarcodeScanButton className="size-12 shrink-0" onDetected={setQ} />
      </div>

      {categoryNames && categoryNames.length > 0 && (
        <NativeSelect
          className="w-full sm:w-auto sm:justify-self-start"
          selectClassName="h-11"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Lọc theo nhóm hàng"
        >
          <option value="">Tất cả nhóm hàng</option>
          {categoryNames.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      )}

      {exact && <PriceCard product={exact} highlight />}

      {active && !isFetching && items.length === 0 && !exact && (
        <EmptyState art={<SearchArt />} title="Không tìm thấy sản phẩm nào.">
          Kiểm tra chính tả, hoặc thử mã SKU hay mã vạch.
        </EmptyState>
      )}
      {!active && (
        <EmptyState art={<SearchArt />} title="Tra giá tại quầy">
          Gõ tên, mã SKU hoặc quét mã vạch để xem giá, hoặc chọn một nhóm hàng để xem cả nhóm.
        </EmptyState>
      )}
      <ul className="grid gap-2">
        {items
          .filter((p) => p.id !== exact?.id)
          .map((p) => (
            <li key={p.id}>
              <PriceCard product={p} />
            </li>
          ))}
      </ul>

      {active && data && data.total > PAGE_SIZE && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          onPage={(p) => {
            setPageState({ key: searchKey, page: p });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}

function PriceCard({ product: p, highlight }: { product: Product; highlight?: boolean }) {
  return (
    <div className={`grid gap-3 rounded-lg border bg-card p-4 ${highlight ? "border-primary ring-1 ring-primary" : ""}`}>
      <div className="flex gap-3">
        <ProductThumb product={p} className="size-20" />
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="font-medium [overflow-wrap:anywhere]">{p.name}</p>
            <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{[p.sku, p.category, p.unit].filter(Boolean).join(" · ")}</p>
            {p.soldByWeight && (
              <Badge variant="secondary" className="mt-1">
                Bán theo cân
              </Badge>
            )}
            {p.note && <p className="mt-1 whitespace-pre-line text-sm [overflow-wrap:anywhere]">Ghi chú: {p.note}</p>}
          </div>
          <PriceList product={p} />
        </div>
      </div>
      {p.soldByWeight && <WeightCalculator product={p} />}
    </div>
  );
}

/** "How much is 300 g?" without opening Tính tiền. Only computes; nothing is saved. */
function WeightCalculator({ product: p }: { product: Product }) {
  const [grams, setGrams] = useState<number | null>(null);
  return (
    <div className="grid gap-1 rounded-md bg-muted/50 p-3">
      <p className="text-sm font-medium">Tính giá theo cân</p>
      <WeightInput compact grams={grams} onChange={setGrams} label={`Số cân ${p.name}`} />
      {grams ? (
        <p className="text-right text-lg font-bold tabular-nums" aria-live="polite" data-testid="weight-total">
          {formatVnd(weightPrice(p, grams))}
        </p>
      ) : null}
      {grams ? (
        <p className="text-right text-xs text-muted-foreground">
          {weightRate(p, grams).per === "100g" ? "Tính theo giá / 100 g (dưới 1 kg)" : "Tính theo giá / kg"}
        </p>
      ) : null}
    </div>
  );
}
