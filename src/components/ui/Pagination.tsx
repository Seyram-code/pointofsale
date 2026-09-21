"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { PaginationMeta } from "@/lib/api/pagination";
import { formatNumber } from "@/lib/utils/format";

export interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-fg-muted tabular">
        Showing {formatNumber(from)}–{formatNumber(to)} of {formatNumber(meta.total)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!meta.hasPrev}
          onClick={() => onPageChange(meta.page - 1)}
          leftIcon={<ChevronLeft className="size-4" />}
        >
          Previous
        </Button>
        <span className="px-1 text-xs text-fg-muted tabular">
          {meta.page} / {meta.totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={!meta.hasNext}
          onClick={() => onPageChange(meta.page + 1)}
          rightIcon={<ChevronRight className="size-4" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
