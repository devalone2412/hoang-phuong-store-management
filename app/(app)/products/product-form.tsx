"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { Camera } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarcodeScanButton } from "@/components/barcode-scanner";
import { ProductThumb } from "@/components/product-bits";
import { MAX_BARCODES, MAX_COMBOS, comboWarnings, priceWarnings, productInputSchema, type Product } from "@/features/products/schema";
import { ApiError, api } from "@/lib/api";
import { formatDateTime, formatVndNumber, parseVnd } from "@/lib/money";

async function encodeWebp(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  if (!blob) throw new Error("encode failed");
  return blob;
}

/** Shrink phone photos before upload: a 1024px WebP plus a 256px thumbnail for the lists. */
async function prepareImage(file: File): Promise<{ main: Blob; thumb: Blob }> {
  const bitmap = await createImageBitmap(file);
  try {
    return { main: await encodeWebp(bitmap, 1024, 0.85), thumb: await encodeWebp(bitmap, 256, 0.8) };
  } finally {
    bitmap.close();
  }
}

type ComboRow = { quantity: string; price: string };

type Props = { open: boolean; onOpenChange: (v: boolean) => void; product: Product | null; units: string[]; categories: string[] };

export function ProductForm(props: Props) {
  // Remount per product so the fields reset without effects.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <FormBody key={props.product?.id ?? "new"} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function FormBody({ onOpenChange, product, units, categories }: Props) {
  const qc = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState({
    retailPrice: formatVndNumber(product?.retailPrice),
    wholesalePrice: formatVndNumber(product?.wholesalePrice),
    costPrice: formatVndNumber(product?.costPrice),
  });

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
      const { main, thumb } = await prepareImage(file).catch(() => {
        throw new Error("Không đọc được ảnh này");
      });
      const body = new FormData();
      body.append("file", main, "image.webp");
      body.append("thumb", thumb, "thumb.webp");
      const { key } = await api<{ key: string }>("/api/images", { method: "POST", body });
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
    wholesalePrice: parseVnd(prices.wholesalePrice),
    costPrice: parseVnd(prices.costPrice),
  };
  const parsedCombos = combos.map((c) => ({ quantity: Number(c.quantity), price: parseVnd(c.price) }));
  const warnings = [
    ...priceWarnings(parsedPrices),
    ...comboWarnings(parsedPrices.retailPrice, parsedCombos as { quantity: number; price: number }[]),
  ];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "");
    const price = (v: number | null) => (v !== null && Number.isNaN(v) ? ("x" as unknown as number) : v);
    const result = productInputSchema.safeParse({
      name: text("name"),
      unit: text("unit"),
      category: text("category"),
      sku: text("sku"),
      barcodes: barcodes.map((b) => b.trim()).filter(Boolean),
      note: text("note"),
      retailPrice: price(parsedPrices.retailPrice),
      wholesalePrice: price(parsedPrices.wholesalePrice),
      costPrice: price(parsedPrices.costPrice),
      imageKey,
      combos: combos
        .filter((c) => c.quantity.trim() || c.price.trim())
        .map((c) => ({
          quantity: c.quantity.trim() ? Number(c.quantity) : ("x" as unknown as number),
          price: c.price.trim() ? (parseVnd(c.price) ?? ("x" as unknown as number)) : ("x" as unknown as number),
        })),
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
  const priceInput = (k: keyof typeof prices, label: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input
        id={k}
        inputMode="decimal"
        placeholder="15.000"
        value={prices[k]}
        onChange={(e) => setPrices((p) => ({ ...p, [k]: e.target.value }))}
      />
      {err(k)}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{product ? "Sửa sản phẩm" : "Thêm sản phẩm"}</DialogTitle>
        {product && <DialogDescription>Cập nhật lần cuối: {formatDateTime(product.updatedAt)}</DialogDescription>}
      </DialogHeader>

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
        <Input id="name" name="name" defaultValue={product?.name} autoFocus />
        {err("name")}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="unit">Đơn vị tính *</Label>
          <Input id="unit" name="unit" list="unit-options" defaultValue={product?.unit} placeholder="cái, kg" />
          <datalist id="unit-options">{units.map((u) => <option key={u} value={u} />)}</datalist>
          {err("unit")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="category">Nhóm hàng</Label>
          <Input id="category" name="category" list="category-options" defaultValue={product?.category ?? ""} />
          <datalist id="category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          {err("category")}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {priceInput("retailPrice", "Giá lẻ *")}
        {priceInput("wholesalePrice", "Giá sỉ")}
        {priceInput("costPrice", "Giá vốn")}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">Nhập nhanh được: 15k = 15.000 · 1,2tr = 1.200.000</p>
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
            <Input
              inputMode="decimal"
              placeholder="20.000"
              aria-label={`Giá combo ${i + 1}`}
              value={c.price}
              onChange={(e) => setCombos((list) => list.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Xóa combo" onClick={() => setCombos((list) => list.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        {err("combos")}
      </div>

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

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Hủy
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Đang lưu…" : "Lưu"}
        </Button>
      </DialogFooter>
    </form>
  );
}
