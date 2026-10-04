import { ClipboardCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The app icon: a squircle with a glossy blue gradient. Size it with a
 * `size-*` class; the glyph scales with it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[27%] bg-[linear-gradient(150deg,#4aa3ff_0%,#0071e3_48%,#0a3d91_100%)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_4px_12px_rgb(0_113_227/0.3)]",
        className
      )}
    >
      <ClipboardCheck className="size-[55%]" />
    </span>
  );
}
