import { z } from "zod";

export const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nhập tên nhóm hàng")
    .max(60, "Tối đa 60 ký tự")
    .transform((v) => v.replace(/\s+/g, " ")),
});

/** Two names with the same key are the same category ("Gạo" = "gạo" = "GẠO"). */
export const categoryKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
export type CategoryInput = z.input<typeof categoryInputSchema>;

/** What the API returns for one category. `productCount` counts live products. */
export type Category = { id: string; name: string; productCount: number };
