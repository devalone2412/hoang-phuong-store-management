import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Hoàng Phương</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">Đăng nhập để quản lý sản phẩm</p>
        <LoginForm />
      </div>
    </main>
  );
}
