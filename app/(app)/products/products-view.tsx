"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, memo, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanButton } from "@/components/barcode-scanner";
import { EmptyState } from "@/components/empty-state";
import { EmptyBoxArt, SearchArt } from "@/components/illustrations";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Product } from "@/features/products/schema";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/money";
import { PriceList, ProductThumb } from "@/components/product-bits";
import { useIsMobile } from "@/hooks/use-mobile";

// The form (with zod and react-hook-form deps) is only needed once someone opens it.
const loadForm = () => import("./product-form").then((m) => ({ default: m.ProductForm }));
const ProductForm = lazy(loadForm);

type ListResult = { items: Product[]; total: number; page: number; pageSize: number };
type Meta = { units: string[]; categories: string[] };

export function ProductsView() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  // Text typed before hydration finished (the box autofocuses) is in the DOM but not in state.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const typed = searchRef.current?.value;
    if (typed) setQ(typed);
  }, []);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMounted, setFormMounted] = useState(false);
  const isMobile = useIsMobile();

  // Fetch the form's code in the background once the list is up, so the first click is instant.
  useEffect(() => {
    const t = setTimeout(() => void loadForm(), 1500);
    return () => clearTimeout(t);
  }, []);

  // Selection only ever refers to rows on screen, so any navigation clears it.
  const setPage = (p: number) => {
    setPageRaw(p);
    setSelected(new Set());
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ q: debouncedQ, page: String(page), pageSize: String(pageSize) });
  if (category) params.set("category", category);

  const list = useQuery({
    queryKey: ["products", debouncedQ, category, page, pageSize],
    queryFn: ({ signal }) => api<ListResult>(`/api/products?${params}`, { signal }),
    placeholderData: keepPreviousData,
  });
  const meta = useQuery({ queryKey: ["meta"], queryFn: ({ signal }) => api<Meta>("/api/meta", { signal }), staleTime: 5 * 60_000 });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["meta"] });
    qc.invalidateQueries({ queryKey: ["lookup"] });
    qc.invalidateQueries({ queryKey: ["by-code"] });
  };

  const restore = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api(`/api/products/${id}/restore`, { method: "POST" }))),
    onSuccess: () => {
      refresh();
      toast.success("Đã khôi phục");
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (ids: string[]) =>
      ids.length === 1
        ? api(`/api/products/${ids[0]}`, { method: "DELETE" })
        : api("/api/products/bulk-delete", { method: "POST", json: { ids } }),
    onSuccess: (_d, ids) => {
      setSelected(new Set());
      refresh();
      toast(`Đã xóa ${ids.length} sản phẩm`, { action: { label: "Hoàn tác", onClick: () => restore.mutate(ids) } });
    },
    onError: (e) => toast.error(e.message),
  });

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // After deleting the last rows of the last page, step back instead of showing an empty page.
  useEffect(() => {
    if (list.data && !list.isPlaceholderData && page > pageCount) setPage(pageCount);
  }, [list.data, list.isPlaceholderData, page, pageCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const allSelected = items.length > 0 && items.every((p) => selected.has(p.id));

  const toggle = useCallback((id: string, on: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);

  const edit = useCallback((p: Product) => {
    setEditing(p);
    setFormMounted(true);
    setFormOpen(true);
  }, []);

  function selectAll(on: boolean) {
    setSelected(on ? new Set(items.map((p) => p.id)) : new Set());
  }

  const removeMutate = remove.mutate;
  const confirmDelete = useCallback(
    (ids: string[], label: string) => {
      if (window.confirm(`Xóa ${label}? Bạn có thể hoàn tác ngay sau đó.`)) removeMutate(ids);
    },
    [removeMutate],
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 md:flex md:items-center">
        <div className="flex gap-2 md:flex-1">
          <Input
            ref={searchRef}
            className="min-w-0 flex-1"
            placeholder="Tìm theo tên, SKU, mã vạch…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm sản phẩm"
          />
          <BarcodeScanButton onDetected={setQ} className="shrink-0" />
        </div>
        <div className="flex gap-2">
          <select
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-base md:w-auto md:flex-none md:text-sm"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo nhóm hàng"
          >
            <option value="">Tất cả nhóm</option>
            {meta.data?.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button
            className="shrink-0"
            aria-label="Thêm sản phẩm"
            onClick={() => {
              setEditing(null);
              setFormMounted(true);
              setFormOpen(true);
            }}
          >
            <Plus />
            <span className="sm:hidden">Thêm</span>
            <span className="hidden sm:inline">Thêm sản phẩm</span>
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted px-3 py-2 text-sm">
          <span>Đã chọn {selected.size}</span>
          <Button size="sm" variant="destructive" onClick={() => confirmDelete([...selected], `${selected.size} sản phẩm đã chọn`)}>
            Xóa
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Bỏ chọn
          </Button>
        </div>
      )}

      {/* Phones: card list. md and up: table. Only the active layout is rendered. */}
      {list.isLoading && <ListSkeleton />}
      {!list.isLoading && items.length === 0 && (
        debouncedQ || category ? (
          <EmptyState art={<SearchArt />} title="Không có sản phẩm phù hợp.">
            Thử từ khóa khác hoặc bỏ bộ lọc nhóm hàng.
          </EmptyState>
        ) : (
          <EmptyState art={<EmptyBoxArt />} title="Chưa có sản phẩm nào.">
            Bấm “Thêm sản phẩm” để nhập mặt hàng đầu tiên.
          </EmptyState>
        )
      )}
      {items.length > 0 && isMobile && (
        <div>
          <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
            <SelectBox checked={allSelected} onChange={selectAll} label="Chọn tất cả" />
            Chọn tất cả trang này
          </div>
          <ul className="grid gap-2">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} checked={selected.has(p.id)} onToggle={toggle} onEdit={edit} onDelete={confirmDelete} />
            ))}
          </ul>
        </div>
      )}
      {items.length > 0 && !isMobile && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <SelectBox checked={allSelected} onChange={selectAll} label="Chọn tất cả" />
                </TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Giá</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <ProductTableRow key={p.id} product={p} checked={selected.has(p.id)} onToggle={toggle} onEdit={edit} onDelete={confirmDelete} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPage={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onPageSize={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />

      {formMounted && (
        <Suspense fallback={null}>
          <ProductForm
            open={formOpen}
            onOpenChange={setFormOpen}
            product={editing}
            units={meta.data?.units ?? []}
            categories={meta.data?.categories ?? []}
          />
        </Suspense>
      )}
    </div>
  );
}

/** Checkbox with a 40px tappable area (the box itself stays 16px). */
function SelectBox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="-m-1 flex size-10 shrink-0 cursor-pointer items-center justify-center">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} aria-label={label} />
    </label>
  );
}

type RowProps = {
  product: Product;
  checked: boolean;
  onToggle: (id: string, on: boolean) => void;
  onEdit: (p: Product) => void;
  onDelete: (ids: string[], label: string) => void;
};

function ListSkeleton() {
  return (
    <div className="grid gap-2" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

function ProductInfo({ p }: { p: Product }) {
  return (
    <>
      <p className="[overflow-wrap:anywhere] font-medium">{p.name}</p>
      <p className="[overflow-wrap:anywhere] text-xs text-muted-foreground">{[p.sku, p.category, p.unit].filter(Boolean).join(" · ")}</p>
      {p.barcodes.length > 0 && <p className="[overflow-wrap:anywhere] text-xs text-muted-foreground">Mã vạch: {p.barcodes.join(", ")}</p>}
      {p.note && <p className="whitespace-pre-line [overflow-wrap:anywhere] text-xs text-muted-foreground">Ghi chú: {p.note}</p>}
      <p className="text-xs text-muted-foreground">Cập nhật: {formatDateTime(p.updatedAt)}</p>
    </>
  );
}

const ProductCard = memo(function ProductCard({ product: p, checked, onToggle, onEdit, onDelete }: RowProps) {
  return (
    <li className={`rounded-lg border bg-card p-3 ${checked ? "border-primary bg-accent" : ""}`}>
      <div className="flex items-start gap-2">
        <SelectBox checked={checked} onChange={(v) => onToggle(p.id, v)} label={`Chọn ${p.name}`} />
        <ProductThumb product={p} />
        <div className="min-w-0 flex-1">
          <ProductInfo p={p} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <PriceList product={p} showCost />
        <RowActions product={p} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </li>
  );
});

const ProductTableRow = memo(function ProductTableRow({ product: p, checked, onToggle, onEdit, onDelete }: RowProps) {
  return (
    <TableRow data-state={checked ? "selected" : undefined}>
      <TableCell className="align-top">
        <SelectBox checked={checked} onChange={(v) => onToggle(p.id, v)} label={`Chọn ${p.name}`} />
      </TableCell>
      <TableCell className="align-top whitespace-normal">
        <div className="flex items-center gap-3">
          <ProductThumb product={p} />
          <div className="min-w-0">
            <ProductInfo p={p} />
          </div>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <PriceList product={p} showCost />
      </TableCell>
      <TableCell className="whitespace-nowrap text-right align-top">
        <RowActions product={p} onEdit={onEdit} onDelete={onDelete} />
      </TableCell>
    </TableRow>
  );
});

function RowActions({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (ids: string[], label: string) => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button size="sm" variant="outline" onClick={() => onEdit(product)}>
        Sửa
      </Button>
      <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete([product.id], `“${product.name}”`)}>
        Xóa
      </Button>
    </div>
  );
}
