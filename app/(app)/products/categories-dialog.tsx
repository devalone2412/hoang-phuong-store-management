"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Category } from "@/features/categories/schema";
import { ApiError, api } from "@/lib/api";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

/** Admin's "Nhóm hàng" list: add, rename and delete the groups products can belong to. */
export function CategoriesDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => api<{ items: Category[] }>("/api/categories", { signal }),
    enabled: open,
    staleTime: 0,
  });
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  // A rename or delete changes the products' group too, so every product-related cache is stale.
  const refresh = () => {
    for (const key of ["categories", "meta", "products", "product", "lookup", "by-code"]) qc.invalidateQueries({ queryKey: [key] });
  };
  const fail = (e: Error) => {
    const msg = e instanceof ApiError ? (e.fields?.name ?? e.message) : e.message;
    setError(msg);
  };

  const add = useMutation({
    mutationFn: (n: string) => api<Category>("/api/categories", { method: "POST", json: { name: n } }),
    onSuccess: () => {
      setName("");
      setError("");
      refresh();
    },
    onError: fail,
  });
  const rename = useMutation({
    mutationFn: (v: { id: string; name: string }) => api<Category>(`/api/categories/${v.id}`, { method: "PATCH", json: { name: v.name } }),
    onSuccess: () => {
      setEditing(null);
      setError("");
      refresh();
      toast.success("Đã đổi tên nhóm hàng");
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<{ affected: number }>(`/api/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setError("");
      refresh();
      toast.success("Đã xóa nhóm hàng");
    },
    onError: fail,
  });

  function onAdd(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) add.mutate(name.trim());
  }

  function onDelete(c: Category) {
    const note = c.productCount > 0 ? ` ${c.productCount} sản phẩm sẽ không còn nhóm.` : "";
    if (window.confirm(`Xóa nhóm “${c.name}”?${note}`)) remove.mutate(c.id);
  }

  const items = list.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14 text-left">
          <DialogTitle>Nhóm hàng</DialogTitle>
          <DialogDescription>Danh sách này hiện trong ô chọn nhóm khi thêm hoặc sửa sản phẩm.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onAdd} className="flex shrink-0 gap-2 border-b px-5 py-3">
          <Input
            className="min-w-0 flex-1 text-base md:text-sm"
            placeholder="Tên nhóm hàng mới"
            aria-label="Tên nhóm hàng mới"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={add.isPending || !name.trim()}>
            <Plus />
            Thêm
          </Button>
        </form>
        {error && <p className="shrink-0 px-5 pt-2 text-sm text-destructive">{error}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3" aria-busy={list.isPending}>
          {list.isPending ? (
            <div className="grid gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : list.error ? (
            <p className="text-sm text-destructive">{list.error.message}</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có nhóm hàng nào. Thêm nhóm đầu tiên ở ô trên.</p>
          ) : (
            <ul className="grid gap-1">
              {items.map((c) => (
                <li key={c.id} className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-1.5">
                  {editing?.id === c.id ? (
                    <form
                      className="flex min-w-0 flex-1 items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editing.name.trim()) rename.mutate({ id: c.id, name: editing.name.trim() });
                      }}
                    >
                      <Input
                        autoFocus
                        className="h-9 min-w-0 flex-1 text-base md:text-sm"
                        aria-label={`Tên mới của nhóm ${c.name}`}
                        maxLength={60}
                        value={editing.name}
                        onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                      />
                      <Button type="submit" size="icon" variant="ghost" className="pointer-coarse:size-11" aria-label="Lưu tên" disabled={rename.isPending}>
                        <Check />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="pointer-coarse:size-11" aria-label="Hủy đổi tên" onClick={() => setEditing(null)}>
                        <X />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                        {c.name}
                        <span className="ml-2 text-xs text-muted-foreground">{c.productCount} sản phẩm</span>
                      </span>
                      <Button type="button" size="icon" variant="ghost" className="pointer-coarse:size-11" aria-label={`Đổi tên nhóm ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}>
                        <Pencil />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="text-destructive pointer-coarse:size-11" aria-label={`Xóa nhóm ${c.name}`} onClick={() => onDelete(c)}>
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-5 py-3">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
