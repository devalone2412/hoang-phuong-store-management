"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { under1kgPrice } from "@/features/products/pricing";
import type { Product } from "@/features/products/schema";
import { thumbKey } from "@/lib/image-keys";
import { formatVnd } from "@/lib/money";
import { cn } from "@/lib/utils";

export const imageUrl = (key: string) => `/api/images/${key}`;

export function ProductThumb({ product, className }: { product: Pick<Product, "name" | "imageKey">; className?: string }) {
  return (
    <div className={cn("flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground", className)}>
      {product.imageKey ? (
        <ThumbImg key={product.imageKey} imageKey={product.imageKey} name={product.name} />
      ) : (
        <ImageOff className="size-5" aria-label="Chưa có ảnh" />
      )}
    </div>
  );
}

/** Lists load the ~256px copy; images uploaded before thumbnails existed fall back to the full file. */
function ThumbImg({ imageKey, name }: { imageKey: string; name: string }) {
  const [full, setFull] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl(full ? imageKey : thumbKey(imageKey))}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => setFull(true)}
      className="size-full object-cover"
    />
  );
}

/** Every price of a product: retail, (cost), and each combo deal. Weighed products show per kg (1 kg and up) and per 100 g (under 1 kg). */
export function PriceList({ product: p, showCost = false }: { product: Product; showCost?: boolean }) {
  if (p.soldByWeight) {
    return (
      <dl className="grid w-fit grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm tabular-nums">
        <Row label="Giá / kg (từ 1 kg)" value={formatVnd(p.retailPrice)} strong />
        {p.price100g != null ? (
          <Row label="Giá / 100 g (dưới 1 kg)" value={formatVnd(p.price100g)} accent />
        ) : (
          <Row label="Giá / 100 g" value={formatVnd(under1kgPrice(p))} muted />
        )}
        {showCost && p.costPrice != null && <Row label="Giá vốn / kg" value={formatVnd(p.costPrice)} muted />}
      </dl>
    );
  }
  return (
    <dl className="grid w-fit grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm tabular-nums">
      <Row label="Giá lẻ" value={formatVnd(p.retailPrice)} strong />
      {showCost && p.costPrice != null && <Row label="Giá vốn" value={formatVnd(p.costPrice)} muted />}
      {p.combos.map((c) => (
        <Row key={c.quantity} label={`Combo ${c.quantity} ${p.unit}`} value={formatVnd(c.price)} accent />
      ))}
    </dl>
  );
}

function Row({ label, value, strong, muted, accent }: { label: string; value: string; strong?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right", strong && "font-semibold", muted && "text-muted-foreground", accent && "font-medium text-primary")}>{value}</dd>
    </>
  );
}
