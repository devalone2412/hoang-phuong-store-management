"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Calculator, Package, Search, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { UserAvatar } from "@/components/user-avatar";
import { BrandLogo } from "@/components/brand-logo";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Tra giá", icon: Search },
  { href: "/checkout", label: "Tính tiền", icon: Calculator },
  { href: "/products", label: "Sản phẩm", icon: Package, adminOnly: true },
  { href: "/staff", label: "Thành viên", icon: Users, adminOnly: true },
];

export function AppNav({ role }: { role: "admin" | "staff" }) {
  const visible = links.filter((l) => role === "admin" || !("adminOnly" in l));
  const pathname = usePathname();
  const qc = useQueryClient();
  // Start loading the product list as soon as a tap/hover on its tab begins. Query keys and URLs
  // must match products-view.tsx so the page picks the result up.
  function warm(href: string) {
    if (href !== "/products") return;
    void qc.prefetchQuery({
      queryKey: ["products", "", "", 1, 20],
      queryFn: ({ signal }) => api(`/api/products?q=&page=1&pageSize=20`, { signal }),
    });
    void qc.prefetchQuery({ queryKey: ["meta"], queryFn: ({ signal }) => api("/api/meta", { signal }), staleTime: 5 * 60_000 });
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <header className="sticky top-0 z-10 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:gap-4 sm:pr-[max(1rem,env(safe-area-inset-right))]">
        <Link href="/" aria-label="Hoàng Phương, về trang tra giá" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
          <BrandLogo withWordmark className="[&>span]:hidden sm:[&>span]:inline" />
        </Link>
        <nav className="min-w-0 flex-1" aria-label="Chính">
          <div className="inline-flex rounded-full bg-muted p-1">
            {visible.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  onPointerEnter={() => warm(l.href)}
                  onTouchStart={() => warm(l.href)}
                  onFocus={() => warm(l.href)}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:px-3.5 sm:text-sm",
                    active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <l.icon className={cn("hidden size-4 sm:block", active && "text-primary")} aria-hidden="true" />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <UserAvatar onLogout={logout} />
      </div>
    </header>
  );
}
