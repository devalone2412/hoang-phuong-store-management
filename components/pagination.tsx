"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  /** When given, shows a page-size selector. */
  onPageSize?: (size: number) => void;
  pageSizes?: number[];
  className?: string;
};

export function Pagination({ page, pageSize, total, onPage, onPageSize, pageSizes = [10, 20, 50], className }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted-foreground", className)}>
      <div className="flex items-center gap-3">
        <span>{total === 0 ? "0 sản phẩm" : `${from}–${to} / ${total} sản phẩm`}</span>
        {onPageSize && (
          <select
            className="h-9 rounded-md border bg-background px-2 text-base text-foreground md:text-sm"
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            aria-label="Số sản phẩm mỗi trang"
          >
            {pageSizes.map((n) => (
              <option key={n} value={n}>
                {n} / trang
              </option>
            ))}
          </select>
        )}
      </div>

      {pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label="Phân trang">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
            <ChevronLeft />
            <span className="hidden sm:inline">Trước</span>
          </Button>

          {/* Phones: compact counter. sm and up: numbered pages. */}
          <span className="px-2 tabular-nums sm:hidden" aria-live="polite">
            {page} / {pageCount}
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            {pageWindow(page, pageCount).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1" aria-hidden>
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  size="sm"
                  variant={p === page ? "default" : "outline"}
                  className="min-w-9 tabular-nums"
                  aria-current={p === page ? "page" : undefined}
                  onClick={() => onPage(p)}
                >
                  {p}
                </Button>
              ),
            )}
          </div>

          <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="Trang sau">
            <span className="hidden sm:inline">Sau</span>
            <ChevronRight />
          </Button>
        </nav>
      )}
    </div>
  );
}
