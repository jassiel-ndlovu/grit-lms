"use client";

/**
 * StockCoverPicker — a row of the stock covers under the CoverUploader.
 *
 * Picking one sets the cover to its path; picking the selected one again
 * clears it. With nothing picked or uploaded, `fallback` (the stock cover
 * for the course name) is outlined and named, since that is what the form
 * will save.
 */

import Image from "next/image";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { STOCK_COVERS, findStockCover, type StockCover } from "../lib/stock-covers";

export interface StockCoverPickerProps {
  /** The form's cover value: "", an upload URL, or a stock path. */
  value: string;
  /** The stock cover used when the value is empty. */
  fallback: StockCover;
  onChange: (url: string) => void;
}

export function StockCoverPicker({ value, fallback, onChange }: StockCoverPickerProps) {
  const picked = findStockCover(value);

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">Or use a stock photo or drawing</p>
      <div role="radiogroup" aria-label="Stock covers" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STOCK_COVERS.map((cover) => {
          const selected = picked?.id === cover.id;
          const isFallback = !value && fallback.id === cover.id;
          return (
            <button
              key={cover.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={cover.label}
              title={cover.label}
              onClick={() => onChange(selected ? "" : cover.src)}
              className={cn(
                "focus-visible:ring-ring relative aspect-video overflow-hidden rounded-md border outline-none focus-visible:ring-2",
                selected
                  ? "border-brand-terracotta ring-brand-terracotta ring-2"
                  : isFallback
                    ? "border-brand-terracotta border-dashed border-2"
                    : "border-border hover:border-ring",
              )}
            >
              <Image src={cover.src} alt="" fill sizes="120px" className="object-cover" />
              {selected && (
                <span className="bg-brand-terracotta text-brand-terracotta-foreground absolute top-1 right-1 rounded-full p-0.5">
                  <Check className="size-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!value && (
        <p className="text-muted-foreground text-xs">
          Nothing chosen yet, so this course will use <span className="text-foreground font-medium">{fallback.label}</span>,
          picked from the course name.
        </p>
      )}
    </div>
  );
}
