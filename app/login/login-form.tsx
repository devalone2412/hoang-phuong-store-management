"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Fields render only after mount. Password-manager extensions (NordPass, 1Password...) inject
  // elements into server-rendered inputs before React hydrates, which causes a hydration mismatch;
  // with no inputs in the server HTML there is nothing for them to touch. This also means the
  // form can never be submitted natively before the submit handler is attached.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(body?.error?.message ?? "Không đăng nhập được, thử lại sau");
        setPending(false);
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      // Only allow same-site relative paths to avoid open redirects.
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch {
      setError("Không kết nối được máy chủ");
      setPending(false);
    }
  }

  if (!ready) return <div aria-hidden className="h-[13.5rem]" />;

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="username">Tên đăng nhập</Label>
        <Input id="username" name="username" autoComplete="username" required autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </form>
  );
}
