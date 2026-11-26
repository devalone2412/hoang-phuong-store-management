import { api } from "@/lib/api";

async function encodeWebp(bitmap: ImageBitmap, maxSide: number, quality: number, square = false): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  if (square) {
    // Centre-crop to a square so the photo fills a round avatar.
    const side = Math.min(bitmap.width, bitmap.height);
    const out = Math.min(maxSide, side);
    canvas.width = canvas.height = out;
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  } else {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  if (!blob) throw new Error("encode failed");
  return blob;
}

/** Shrink a phone photo before upload: a WebP of at most `maxSide` px plus a 256px thumbnail for lists. */
export async function prepareImage(file: File, opts: { maxSide?: number; square?: boolean } = {}): Promise<{ main: Blob; thumb: Blob }> {
  const { maxSide = 1024, square = false } = opts;
  const bitmap = await createImageBitmap(file);
  try {
    return { main: await encodeWebp(bitmap, maxSide, 0.85, square), thumb: await encodeWebp(bitmap, 256, 0.8, square) };
  } finally {
    bitmap.close();
  }
}

/** Resize, upload to POST /api/images, and return the new image key. */
export async function uploadImage(file: File, opts?: { maxSide?: number; square?: boolean }): Promise<string> {
  const { main, thumb } = await prepareImage(file, opts).catch(() => {
    throw new Error("Không đọc được ảnh này");
  });
  const body = new FormData();
  body.append("file", main, "image.webp");
  body.append("thumb", thumb, "thumb.webp");
  const { key } = await api<{ key: string }>("/api/images", { method: "POST", body });
  return key;
}
