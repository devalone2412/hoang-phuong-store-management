"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { Camera } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { BarcodeScanButton } from "@/components/barcode-scanner";
import { MoneyInput } from "@/components/money-input";
import { ProductThumb } from "@/components/product-bits";
import type { Category } from "@/features/categories/schema";
import { weightPrice } from "@/features/products/pricing";
import {
  MAX_BARCODES,
  MAX_COMBOS,
  WEIGHT_UNIT,
  comboWarnings,
  priceWarnings,
  productInputSchema,
  type Product,
} from "@/features/products/schema";
import { ApiError, api } from "@/lib/api";
import { formatDateTime, formatVnd, formatVndNumber, parseVnd } from "@/lib/money";
import { uploadImage } from "@/lib/upload-image";

const NEW_CATEGORY = "__new__";

type ComboRow = { quantity: string; price: string };

type Props = { open: boolean; onOpenChange: (v: boolean) => void; productId: string | null; units: string[]; categories: string[] };
type BodyProps = Omit<Props, "productId" | "open"> & { product: Product | null };

export function ProductForm({ open, onOpenChange, productId, units, categories }: Props) {
  // Editing always loads the full record from the server: the list row can be stale, and the form
  // fields are uncontrolled, so it must only mount once with the data it should show.
  const detail = useQuery({
    queryKey: ["product", productId],
    queryFn: ({ signal }) => api<Product>(`/api/products/${productId}`, { signal }),
    enabled: open && !!productId,
    staleTime: 0,
    gcTime: 0,
    retry: (count, e) => !(e instanceof ApiError && e.status === 404) && count < 2,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Header and footer stay put; only the fields scroll, so Lưu is always reachable on any screen height. */}
      <DialogContent className="flex max-h-[calc(100svh-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(52rem,calc(100svh-3rem))] sm:max-w-xl">
        {!productId ? (
          <FormBody key="new" product={null} onOpenChange={onOpenChange} units={units} categories={categories} />
        ) : detail.data ? (
          <FormBody
            key={`${detail.data.id}:${detail.data.updatedAt}`}
            product={detail.data}
            onOpenChange={onOpenChange}
            units={units}
            categories={categories}
          />
        ) : (
          <LoadState error={detail.error} onRetry={() => void detail.refetch()} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoadState({ error, onRetry, onClose }: { error: Error | null; onRetry: () => void; onClose: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <>
      <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14 text-left sm:px-6">
        <DialogTitle>Sửa sản phẩm</DialogTitle>
        <DialogDescription className="sr-only">Đang tải thông tin sản phẩm</DialogDescription>
      </DialogHeader>
      <div className="grid content-start gap-4 px-5 py-4 sm:px-6" aria-busy={!error}>
        {error ? (
          <p className="text-sm text-destructive">{notFound ? "Không tìm thấy sản phẩm (có thể đã bị xóa)." : error.message}</p>
        ) : (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </>
        )}
      </div>
      <DialogFooter className="shrink-0 gap-2 border-t px-5 py-3 sm:px-6">
        <Button type="button" variant="outline" onClick={onClose}>
          {notFound ? "Đóng" : "Hủy"}
        </Button>
        {error && !notFound && (
          <Button type="button" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function FormBody({ onOpenChange, product, units, categories }: BodyProps) {
  const qc = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState({
    retailPrice: formatVndNumber(product?.retailPrice),
    costPrice: formatVndNumber(product?.costPrice),
    price100g: formatVndNumber(product?.price100g),
  });

  const [soldByWeight, setSoldByWeight] = useState(product?.soldByWeight ?? false);
  const [unit, setUnit] = useState(product?.unit ?? "");

  // The dropdown shows the admin's list, plus any group created from this form before the list reloads.
  const [category, setCategory] = useState(product?.category ?? "");
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState<string | null>(null); // null = not adding
  const [addingCategory, setAddingCategory] = useState(false);
  const categoryOptions = [...new Set([...categories, ...localCategories])].sort((a, b) => a.localeCompare(b, "vi"));
  const categoryChoices = category && !categoryOptions.includes(category) ? [category, ...categoryOptions] : categoryOptions;

  async function addCategory() {
    const name = (newCategory ?? "").trim();
    if (!name) return;
    const existing = categoryChoices.find((c) => c.toLowerCase() === name.toLowerCase());
    if (existing) {
      setCategory(existing);
      setNewCategory(null);
      return;
    }
    setAddingCategory(true);
    try {
      const created = await api<Category>("/api/categories", { method: "POST", json: { name } });
      setLocalCategories((l) => [...l, created.name]);
      setCategory(created.name);
      setNewCategory(null);
      setErrors((e) => ({ ...e, category: "" }));
      qc.invalidateQueries({ queryKey: ["meta"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? (e.fields?.name ?? e.message) : "Không thêm được nhóm hàng");
    } finally {
      setAddingCategory(false);
    }
  }

  const [imageKey, setImageKey] = useState<string | null>(product?.imageKey ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // `capture` only does something on phones/tablets; on a laptop it would just reopen the file picker.
  const [hasTouchCamera, setHasTouchCamera] = useState(false);
  useEffect(() => setHasTouchCamera(window.matchMedia("(pointer: coarse)").matches), []);
  const [combos, setCombos] = useState<ComboRow[]>(
    (product?.combos ?? []).map((c) => ({ quantity: String(c.quantity), price: formatVndNumber(c.price) })),
  );

  const [barcodes, setBarcodes] = useState<string[]>(product?.barcodes.length ? product.barcodes : [""]);
  const setBarcode = (i: number, v: string) => setBarcodes((list) => list.map((x, j) => (j === i ? v : x)));

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const key = await uploadImage(file);
      setImageKey(key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tải ảnh thất bại");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  const save = useMutation({
    mutationFn: (data: unknown) =>
      product
        ? api<Product>(`/api/products/${product.id}`, { method: "PATCH", json: data })
        : api<Product>("/api/products", { method: "POST", json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
      qc.invalidateQueries({ queryKey: ["lookup"] });
      qc.invalidateQueries({ queryKey: ["by-code"] });
      toast.success(product ? "Đã cập nhật sản phẩm" : "Đã thêm sản phẩm");
      onOpenChange(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      else toast.error(e.message);
    },
  });

  const parsedPrices = {
    retailPrice: parseVnd(prices.retailPrice),
    costPrice: parseVnd(prices.costPrice),
    price100g: soldByWeight ? parseVnd(prices.price100g) : null,
  };
  const parsedCombos = combos.map((c) => ({ quantity: Number(c.quantity), price: parseVnd(c.price) }));
  const warnings = [
    ...priceWarnings(parsedPrices),
    ...(soldByWeight ? [] : comboWarnings(parsedPrices.retailPrice, parsedCombos as { quantity: number; price: number }[])),
  ];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newCategory?.trim()) {
      setErrors({ category: "Bấm “Thêm” để tạo nhóm hàng mới trước khi lưu" });
      return;
    }
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "");
    const price = (v: number | null) => (v !== null && Number.isNaN(v) ? ("x" as unknown as number) : v);
    const result = productInputSchema.safeParse({
      name: text("name"),
      unit: soldByWeight ? WEIGHT_UNIT : unit,
      soldByWeight,
      category,
      sku: text("sku"),
      barcodes: barcodes.map((b) => b.trim()).filter(Boolean),
      note: text("note"),
      retailPrice: price(parsedPrices.retailPrice),
      costPrice: price(parsedPrices.costPrice),
      imageKey,
      combos: (soldByWeight ? [] : combos)
        .filter((c) => c.quantity.trim() || c.price.trim())
        .map((c) => ({
          quantity: c.quantity.trim() ? Number(c.quantity) : ("x" as unknown as number),
          price: c.price.trim() ? (parseVnd(c.price) ?? ("x" as unknown as number)) : ("x" as unknown as number),
        })),
      price100g: price(parsedPrices.price100g),
    });
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const i of result.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate(result.data);
  }

  const err = (k: string) => (errors[k] ? <p className="text-sm text-destructive">{errors[k]}</p> : null);
  // What a customer would pay at a few weights, so the admin sees the effect of the 100 g price.
  const retail = parsedPrices.retailPrice;
  const perKgHint =
    soldByWeight && retail != null && !Number.isNaN(retail) && !Number.isNaN(parsedPrices.price100g ?? 0)
      ? [300, 500, 1000]
          .map((g) => `${g === 1000 ? "1 kg" : `${g} g`} ${formatVnd(weightPrice({ retailPrice: retail, price100g: parsedPrices.price100g }, g))}`)
          .join(" · ")
      : null;
  const priceInput = (k: keyof typeof prices, label: string, className?: string, placeholder = "15.000") => (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={k}>{label}</Label>
      <MoneyInput id={k} placeholder={placeholder} value={prices[k]} onChange={(v) => setPrices((p) => ({ ...p, [k]: v }))} />
      {err(k)}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14 text-left sm:px-6">
        <DialogTitle>{product ? "Sửa sản phẩm" : "Thêm sản phẩm"}</DialogTitle>
        {product && <DialogDescription>Cập nhật lần cuối: {formatDateTime(product.updatedAt)}</DialogDescription>}
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto [&>*]:shrink-0 overscroll-contain px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <ProductThumb product={{ name: product?.name ?? "Ảnh sản phẩm", imageKey }} className="size-20" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPickImage(e.target.files?.[0])}
            aria-label="Chọn ảnh từ thiết bị"
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => onPickImage(e.target.files?.[0])}
            aria-label="Chụp ảnh sản phẩm"
          />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <ImagePlus />
            {uploading ? "Đang tải ảnh…" : "Chọn ảnh"}
          </Button>
          {hasTouchCamera && (
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => cameraRef.current?.click()}>
              <Camera />
              Chụp ảnh
            </Button>
          )}
          {imageKey && !uploading && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setImageKey(null)}>
              Xóa ảnh
            </Button>
          )}
        </div>
      </div>
      {err("imageKey")}

      <div className="grid gap-1.5">
        <Label htmlFor="name">Tên sản phẩm *</Label>
        <Input id="name" name="name" defaultValue={product?.name} autoFocus={!window.matchMedia("(pointer: coarse)").matches} />
        {err("name")}
      </div>

      <label htmlFor="soldByWeight" className="flex h-auto min-h-11 shrink-0 cursor-pointer items-start gap-3 rounded-md pb-3 pt-1">
        <Checkbox
          id="soldByWeight"
          className="mt-0.5"
          checked={soldByWeight}
          onCheckedChange={(v) => {
            const on = v === true;
            setSoldByWeight(on);
            if (on) setCombos([]);
          }}
        />
        <span className="grid min-w-0 gap-0.5 text-sm">
          <span className="font-medium">Bán theo cân (kg / gram)</span>
          <span className="text-xs leading-relaxed text-muted-foreground">Nhập giá theo 1 kg. Khi tính tiền, nhập số cân khách mua (vd 1,2kg hoặc 100g).</span>
        </span>
      </label>

      <div className="grid grid-cols-2 items-start gap-3 [&>*]:min-w-0">
        <div className="grid gap-1.5">
          <Label htmlFor="unit">Đơn vị tính {soldByWeight ? "" : "*"}</Label>
          <Input
            id="unit"
            name="unit"
            list="unit-options"
            value={soldByWeight ? WEIGHT_UNIT : unit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={soldByWeight}
            placeholder="cái, hộp"
          />
          <datalist id="unit-options">{units.map((u) => <option key={u} value={u} />)}</datalist>
          {err("unit")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="category">Nhóm hàng</Label>
          {/* A native select: reliable in installed PWAs on iOS and Android, unlike <datalist>. */}
          <NativeSelect
            id="category"
            value={newCategory !== null ? NEW_CATEGORY : category}
            onChange={(e) => {
              if (e.target.value === NEW_CATEGORY) setNewCategory("");
              else {
                setNewCategory(null);
                setCategory(e.target.value);
              }
            }}
          >
            <option value="">— Không có nhóm —</option>
            {categoryChoices.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NEW_CATEGORY}>+ Thêm nhóm mới…</option>
          </NativeSelect>
          {err("category")}
        </div>
      </div>
      {newCategory !== null && (
        <div className="flex gap-2">
          <Input
            autoFocus
            className="min-w-0 flex-1 text-base md:text-sm"
            placeholder="Tên nhóm hàng mới"
            aria-label="Tên nhóm hàng mới"
            maxLength={60}
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addCategory();
              }
            }}
          />
          <Button type="button" disabled={addingCategory || !newCategory.trim()} onClick={() => void addCategory()}>
            {addingCategory ? "Đang thêm…" : "Thêm"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setNewCategory(null)}>
            Hủy
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 items-start gap-x-3 gap-y-3 [&>*]:min-w-0">
        {priceInput("retailPrice", soldByWeight ? "Giá lẻ / kg *" : "Giá lẻ *")}
        {priceInput("costPrice", soldByWeight ? "Giá vốn / kg" : "Giá vốn")}
        {soldByWeight &&
          priceInput(
            "price100g",
            "Giá / 100 g (dưới 1 kg)",
            "col-span-2",
            retail != null && !Number.isNaN(retail) ? formatVndNumber(Math.round(retail / 10)) : "15.000",
          )}
      </div>
      {soldByWeight && (
        <p className="text-xs text-muted-foreground">
          Từ 1 kg tính theo giá / kg, dưới 1 kg tính theo giá / 100 g. Để trống thì lấy giá / kg ÷ 10.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Gõ 15 rồi bấm k = 15.000 · gõ 1,2 rồi bấm tr = 1.200.000{perKgHint && <span className="font-medium text-foreground"> · {perKgHint}</span>}
      </p>
      {!soldByWeight && (
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Giá combo</Label>
          {combos.length < MAX_COMBOS && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setCombos((c) => [...c, { quantity: "", price: "" }])}>
              <Plus />
              Thêm combo
            </Button>
          )}
        </div>
        {combos.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="w-20"
              inputMode="numeric"
              placeholder="SL"
              aria-label={`Số lượng combo ${i + 1}`}
              value={c.quantity}
              onChange={(e) => setCombos((list) => list.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
            />
            <span className="text-sm text-muted-foreground">giá</span>
            <MoneyInput
              className="min-w-0 flex-1"
              placeholder="20.000"
              aria-label={`Giá combo ${i + 1}`}
              value={c.price}
              onChange={(v) => setCombos((list) => list.map((x, j) => (j === i ? { ...x, price: v } : x)))}
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Xóa combo" onClick={() => setCombos((list) => list.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        {err("combos")}
      </div>
      )}

      {warnings.map((w) => (
        <p key={w} className="text-sm text-amber-600">{w}</p>
      ))}

      <div className="grid gap-1.5">
        <Label htmlFor="sku">Mã SKU</Label>
        <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
        {err("sku")}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="barcode-0">Mã vạch</Label>
          {barcodes.length < MAX_BARCODES && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setBarcodes((list) => [...list, ""])}>
              <Plus />
              Thêm mã vạch
            </Button>
          )}
        </div>
        {barcodes.map((b, i) => (
          <div key={i} className="flex gap-2">
            <Input
              id={`barcode-${i}`}
              inputMode="numeric"
              aria-label={`Mã vạch ${i + 1}`}
              value={b}
              onChange={(e) => setBarcode(i, e.target.value)}
              // A hardware scanner ends with Enter; don't let that submit the whole form.
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />
            <BarcodeScanButton onDetected={(code) => setBarcode(i, code)} />
            {barcodes.length > 1 && (
              <Button type="button" variant="ghost" size="icon" aria-label={`Xóa mã vạch ${i + 1}`} onClick={() => setBarcodes((list) => list.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
        {err("barcodes")}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="note">Ghi chú</Label>
        <Input id="note" name="note" defaultValue={product?.note ?? ""} />
        {err("note")}
      </div>

      </div>

      <DialogFooter className="grid shrink-0 grid-cols-2 gap-2 border-t bg-background px-5 py-3 sm:flex sm:px-6">
        <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => onOpenChange(false)}>
          Hủy
        </Button>
        <Button type="submit" className="h-11 sm:h-9" disabled={save.isPending}>
          {save.isPending ? "Đang lưu…" : "Lưu"}
        </Button>
      </DialogFooter>
    </form>
  );
}
