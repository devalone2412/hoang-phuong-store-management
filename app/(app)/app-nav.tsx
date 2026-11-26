"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Tra giá" },
  { href: "/checkout", label: "Tính tiền" },
  { href: "/products", label: "Sản phẩm" },
];

export function AppNav() {
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
    <header className="sticky top-0 z-10 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:gap-4 sm:pr-[max(1rem,env(safe-area-inset-right))]">
        <span className="font-semibold">
          <span className="sm:hidden">HP</span>
          <span className="hidden sm:inline">Hoàng Phương</span>
        </span>
        <nav className="flex min-w-0 flex-1 gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onPointerEnter={() => warm(l.href)}
              onTouchStart={() => warm(l.href)}
              onFocus={() => warm(l.href)}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground",
                (l.href === "/" ? pathname === "/" : pathname.startsWith(l.href)) && "bg-muted text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" size="sm" onClick={logout} aria-label="Đăng xuất">
          <LogOut />
          <span className="hidden sm:inline">Đăng xuất</span>
        </Button>
      </div>
    </header>
  );
}
