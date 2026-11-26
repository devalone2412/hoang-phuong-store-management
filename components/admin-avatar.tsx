"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2, LogOut, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { imageUrl } from "@/components/product-bits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { thumbKey } from "@/lib/image-keys";
import { uploadImage } from "@/lib/upload-image";
import { cn } from "@/lib/utils";

type Profile = { username: string; avatarKey: string | null };

const initials = (name: string) => name.trim().slice(0, 2).toUpperCase() || "HP";

/** Round photo, or initials on jade when there is none. */
function Face({ profile, className, busy }: { profile?: Profile; className?: string; busy?: boolean }) {
  return (
    <span className={cn("relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground", className)}>
      {profile?.avatarKey ? (
        <AvatarImg key={profile.avatarKey} imageKey={profile.avatarKey} />
      ) : (
        <span data-testid="admin-avatar-initials">{initials(profile?.username ?? "")}</span>
      )}
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white" role="status" aria-label="Đang tải ảnh">
          <Loader2 className="size-4 animate-spin" />
        </span>
      )}
    </span>
  );
}

/** Admin's photo at the far right of the header. Its menu changes the photo and holds log out. */
export function AdminAvatar({ onLogout }: { onLogout: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: ({ signal }) => api<Profile>("/api/profile", { signal }),
    staleTime: Infinity,
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // `capture` only does something on phones/tablets; on a laptop it would just reopen the file picker.
  const [hasTouchCamera, setHasTouchCamera] = useState(false);
  useEffect(() => setHasTouchCamera(window.matchMedia("(pointer: coarse)").matches), []);

  const setAvatar = useMutation({
    mutationFn: async (file: File | null) => {
      const avatarKey = file ? await uploadImage(file, { maxSide: 512, square: true }) : null;
      return api<Profile>("/api/profile", { method: "PUT", json: { avatarKey } });
    },
    onSuccess: (profile, file) => {
      qc.setQueryData(["profile"], profile);
      toast.success(file ? "Đã cập nhật ảnh đại diện" : "Đã xóa ảnh đại diện");
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => {
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    },
  });

  const onPick = (file: File | undefined) => file && setAvatar.mutate(file);
  const item = "gap-3 py-2.5";

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="Chọn ảnh đại diện từ thiết bị" onChange={(e) => onPick(e.target.files?.[0])} />
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} aria-label="Chụp ảnh đại diện" onChange={(e) => onPick(e.target.files?.[0])} />
      <span className="relative shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Tài khoản"
            data-testid="admin-avatar"
            className="block rounded-full ring-2 ring-primary/25 transition-shadow hover:ring-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:ring-primary"
          >
            <Face profile={data} busy={setAvatar.isPending} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="flex items-center gap-3 px-2 py-2.5">
              <Face profile={data} className="size-12 text-base" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{data?.username || "Quản trị viên"}</p>
                <p className="text-xs text-muted-foreground">Quản trị viên</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className={item} onSelect={() => fileRef.current?.click()}>
                <ImagePlus />
                Chọn ảnh từ máy
              </DropdownMenuItem>
              {hasTouchCamera && (
                <DropdownMenuItem className={item} onSelect={() => cameraRef.current?.click()}>
                  <Camera />
                  Chụp ảnh
                </DropdownMenuItem>
              )}
              {data?.avatarKey && (
                <DropdownMenuItem className={item} onSelect={() => setAvatar.mutate(null)}>
                  <Trash2 />
                  Xóa ảnh đại diện
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={item} variant="destructive" onSelect={onLogout}>
              <LogOut />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Nudge until there is a photo; it is part of the trigger visually but not tappable itself. */}
        {data && !data.avatarKey && (
          <span className="pointer-events-none absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-price-tag text-price-tag-foreground ring-2 ring-background" aria-hidden="true">
            <Camera className="size-2" />
          </span>
        )}
      </span>
    </>
  );
}

/** The 256px copy first; falls back to the full file if the thumbnail is missing. */
function AvatarImg({ imageKey }: { imageKey: string }) {
  const [full, setFull] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl(full ? imageKey : thumbKey(imageKey))} alt="Ảnh đại diện" onError={() => setFull(true)} className="size-full object-cover" />
  );
}
