"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BarcodeScanButton } from "@/components/barcode-scanner";
import { EmptyState } from "@/components/empty-state";
import { SearchArt } from "@/components/illustrations";
import { Pagination } from "@/components/pagination";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { PriceList, ProductThumb } from "@/components/product-bits";
import type { Product } from "@/features/products/schema";

type LookupResult = { exact: Product | null; items: Product[]; total: number; page: number; pageSize: number };
const PAGE_SIZE = 20;

const fetchLookup = (q: string, page: number, signal?: AbortSignal) =>
  api<LookupResult>(`/api/lookup?q=${encodeURIComponent(q)}&page=${page}&pageSize=${PAGE_SIZE}`, { signal });

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
  const [pageState, setPageState] = useState({ q: "", page: 1 });
  // A new query always starts on page 1 (derived, so there is no render with a stale page).
  const page = pageState.q === debounced ? pageState.page : 1;
  const qc = useQueryClient();
  const { data, isFetching } = useQuery({
    queryKey: ["lookup", debounced, page],
    queryFn: ({ signal }) => fetchLookup(debounced, page, signal),
    enabled: debounced.length > 0,
    placeholderData: keepPreviousData,
  });

  // Warm the next page so "Sau" feels instant.
  const hasNext = !!data && page * PAGE_SIZE < data.total;
  useEffect(() => {
    if (debounced && hasNext) void qc.prefetchQuery({ queryKey: ["lookup", debounced, page + 1], queryFn: ({ signal }) => fetchLookup(debounced, page + 1, signal) });
  }, [qc, debounced, page, hasNext]);

  const items = debounced ? (data?.items ?? []) : [];
  const exact = debounced ? data?.exact : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex gap-2">
        <Input
          ref={searchRef}
          autoFocus
          inputMode="search"
          placeholder="Tên, mã SKU hoặc quét mã vạch…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-12 flex-1 text-base"
          aria-label="Tìm sản phẩm"
        />
        <BarcodeScanButton className="size-12 shrink-0" onDetected={setQ} />
      </div>

      {exact && <PriceCard product={exact} highlight />}

      {debounced && !isFetching && items.length === 0 && (
        <EmptyState art={<SearchArt />} title="Không tìm thấy sản phẩm nào.">
          Kiểm tra chính tả, hoặc thử mã SKU hay mã vạch.
        </EmptyState>
      )}
      {!debounced && (
        <EmptyState art={<SearchArt />} title="Tra giá tại quầy">
          Gõ tên, mã SKU hoặc quét mã vạch để xem giá.
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

      {debounced && data && data.total > PAGE_SIZE && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          onPage={(p) => {
            setPageState({ q: debounced, page: p });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}

function PriceCard({ product: p, highlight }: { product: Product; highlight?: boolean }) {
  return (
    <div className={`flex gap-3 rounded-lg border bg-card p-4 ${highlight ? "border-primary ring-1 ring-primary" : ""}`}>
      <ProductThumb product={p} className="size-20" />
      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-medium [overflow-wrap:anywhere]">{p.name}</p>
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{[p.sku, p.category, p.unit].filter(Boolean).join(" · ")}</p>
          {p.note && <p className="mt-1 whitespace-pre-line text-sm [overflow-wrap:anywhere]">Ghi chú: {p.note}</p>}
        </div>
        <PriceList product={p} />
      </div>
    </div>
  );
}
