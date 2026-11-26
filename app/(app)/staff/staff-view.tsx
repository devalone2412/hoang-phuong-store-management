"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Lock, LockOpen, MoreVertical, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Face } from "@/components/user-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUserSchema, type StaffCredentials, type StaffUser } from "@/features/users/schema";
import { ApiError, api } from "@/lib/api";

const KEY = ["staff"] as const;

export function StaffView() {
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => api<{ items: StaffUser[] }>("/api/users", { signal }),
  });
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<StaffUser | null>(null);
  // Holds the plain password right after create/reset. Lives only in memory; closing the dialog discards it.
  const [credentials, setCredentials] = useState<{ username: string; password: string; reset: boolean } | null>(null);
  const [deleting, setDeleting] = useState<StaffUser | null>(null);

  const toggle = useMutation({
    mutationFn: (u: StaffUser) => api<StaffCredentials>(`/api/users/${u.id}`, { method: "PATCH", json: { disabled: !u.disabled } }),
    onSuccess: ({ user: u }) => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success(u.disabled ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (u: StaffUser) => api(`/api/users/${u.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success("Đã xóa thành viên");
      setDeleting(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const items = data?.items ?? [];
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Thành viên</h1>
          <p className="text-sm text-muted-foreground">Thành viên chỉ dùng được Tra giá và Tính tiền.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> Thêm thành viên
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Chưa có thành viên nào.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((u) => (
            <li key={u.id} className="flex items-center gap-3 p-3" data-testid="staff-row">
              <Face profile={{ role: "staff", username: u.username, displayName: u.displayName, avatarKey: u.avatarKey }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.displayName || u.username}</p>
                <p className="truncate text-xs text-muted-foreground">{u.username}</p>
              </div>
              <Badge variant={u.disabled ? "secondary" : "default"}>{u.disabled ? "Đã khóa" : "Đang hoạt động"}</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Thao tác với ${u.username}`}>
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setResetting(u)}>
                    <KeyRound /> Đặt lại mật khẩu
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toggle.mutate(u)}>
                    {u.disabled ? <LockOpen /> : <Lock />}
                    {u.disabled ? "Mở khóa" : "Khóa tài khoản"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(u)}>
                    <Trash2 /> Xóa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <CreateDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(c) => setCredentials({ username: c.user.username, password: c.password, reset: false })}
      />
      <ResetDialog
        user={resetting}
        onClose={() => setResetting(null)}
        onReset={(c) => setCredentials({ username: c.user.username, password: c.password, reset: true })}
      />
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa thành viên {deleting?.username}?</AlertDialogTitle>
            <AlertDialogDescription>Tài khoản sẽ bị xóa và đăng xuất ngay. Không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleting) remove.mutate(deleting);
              }}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (c: StaffCredentials) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <CreateForm
            onDone={() => onOpenChange(false)}
            onCreated={(c) => {
              onOpenChange(false);
              onCreated(c);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateForm({ onDone, onCreated }: { onDone: () => void; onCreated: (c: StaffCredentials) => void }) {
  const qc = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: (json: unknown) => api<StaffCredentials>("/api/users", { method: "POST", json }),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: KEY });
      onCreated(c);
    },
    onError: (e) => (e instanceof ApiError && e.fields ? setErrors(e.fields) : toast.error(e.message)),
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = createUserSchema.safeParse({ username: f.get("username"), displayName: f.get("displayName") });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      return setErrors(next);
    }
    setErrors({});
    create.mutate(parsed.data);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Thêm thành viên</DialogTitle>
        <DialogDescription>Mật khẩu sẽ được tạo tự động và chỉ hiển thị một lần sau khi tạo.</DialogDescription>
      </DialogHeader>
      <FieldRow id="username" label="Tên đăng nhập" error={errors.username}>
        <Input id="username" name="username" autoComplete="off" autoCapitalize="none" aria-invalid={!!errors.username} />
      </FieldRow>
      <FieldRow id="displayName" label="Tên hiển thị (không bắt buộc)" error={errors.displayName}>
        <Input id="displayName" name="displayName" autoComplete="off" aria-invalid={!!errors.displayName} />
      </FieldRow>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Hủy
        </Button>
        <Button type="submit" disabled={create.isPending}>
          Tạo tài khoản
        </Button>
      </DialogFooter>
    </form>
  );
}

function ResetDialog({
  user,
  onClose,
  onReset,
}: {
  user: StaffUser | null;
  onClose: () => void;
  onReset: (c: StaffCredentials) => void;
}) {
  const reset = useMutation({
    mutationFn: (u: StaffUser) => api<StaffCredentials>(`/api/users/${u.id}`, { method: "PATCH", json: { resetPassword: true } }),
    onSuccess: (c) => {
      onClose();
      onReset(c);
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <AlertDialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Đặt lại mật khẩu cho {user?.username}?</AlertDialogTitle>
          <AlertDialogDescription>
            Hệ thống tạo mật khẩu mới và đăng xuất thành viên khỏi mọi thiết bị. Mật khẩu mới chỉ hiển thị một lần.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction
            disabled={reset.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (user) reset.mutate(user);
            }}
          >
            Đặt lại
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Clipboard API needs a secure context; the textarea trick covers plain-http or locked-down browsers. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      ta.remove();
    }
  }
}

function CopyButton({ text, label, children }: { text: string; label: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!(await copyText(text))) return toast.error("Không sao chép được, hãy bôi đen và chép thủ công");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button type="button" variant="outline" size={children ? "default" : "icon"} onClick={copy} aria-label={label}>
      {copied ? <Check /> : <Copy />}
      {children && (copied ? "Đã sao chép" : children)}
    </Button>
  );
}

/** The only place the plain password is ever shown. It can't be dismissed by a stray click or Esc. */
function CredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: { username: string; password: string; reset: boolean } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!credentials} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {credentials && (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{credentials.reset ? "Mật khẩu mới" : "Đã tạo tài khoản"}</DialogTitle>
              <DialogDescription>
                Hãy sao chép và lưu lại ngay bây giờ. Mật khẩu chỉ hiển thị một lần và không thể xem lại.
              </DialogDescription>
            </DialogHeader>
            <dl className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Tên đăng nhập</dt>
                  <dd className="select-all truncate font-mono text-base">{credentials.username}</dd>
                </div>
                <CopyButton text={credentials.username} label="Sao chép tên đăng nhập" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Mật khẩu</dt>
                  <dd className="select-all break-all font-mono text-lg font-semibold tracking-wide" data-testid="generated-password">
                    {credentials.password}
                  </dd>
                </div>
                <CopyButton text={credentials.password} label="Sao chép mật khẩu" />
              </div>
            </dl>
            <DialogFooter>
              <CopyButton text={`Tên đăng nhập: ${credentials.username}\nMật khẩu: ${credentials.password}`} label="Sao chép cả hai">
                Sao chép cả hai
              </CopyButton>
              <Button type="button" onClick={onClose}>
                Đã lưu, đóng
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
