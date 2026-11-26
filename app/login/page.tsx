import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { StorefrontArt } from "@/components/illustrations";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  return (
    <main className="grid min-h-svh grid-rows-[auto_1fr] bg-background lg:grid-cols-[1.15fr_1fr] lg:grid-rows-1">
      {/* Brand panel: a fixed deep jade in both themes, so the storefront drawing never changes colour. */}
      <section className="relative flex flex-col overflow-hidden bg-brand-deep px-6 pb-12 pt-[max(2rem,env(safe-area-inset-top))] text-white lg:justify-between lg:p-14">
        <BrandLogo inverse withWordmark className="text-lg" />
        <div className="mt-6 lg:mt-0">
          <h1 className="max-w-[18ch] text-balance text-3xl font-bold leading-[1.15] tracking-tight lg:text-5xl">Tra giá nhanh, tính tiền gọn.</h1>
          <p className="mt-3 hidden max-w-[40ch] text-base leading-relaxed text-white/75 lg:block">
            Quét mã vạch hoặc gõ tên để xem giá lẻ, giá sỉ và giá combo ngay tại quầy.
          </p>
        </div>
        <StorefrontArt className="mt-6 h-32 w-auto max-w-full self-start lg:mt-0 lg:h-auto lg:w-full lg:max-w-lg" />
      </section>

      {/* On phones the form is a sheet that overlaps the panel; on large screens it is its own column. */}
      <section className="relative -mt-6 rounded-t-3xl bg-background px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-8 lg:mt-0 lg:flex lg:items-center lg:justify-center lg:rounded-none lg:p-14">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="text-2xl font-bold tracking-tight">Đăng nhập</h2>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Dành cho quản trị viên cửa hàng.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
