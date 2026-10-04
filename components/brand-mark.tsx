import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";

/**
 * The Verityio mark: a "V" drawn as a checkmark (verified, on the record)
 * with the dot of the "i", on a glossy blue squircle. Same artwork as
 * public/brand/verityio-mark.svg and the app icons. Size it with a `size-*`
 * class; everything scales with it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-[23%] bg-[linear-gradient(150deg,#4aa3ff_0%,#0071e3_50%,#0a3d91_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_4px_12px_rgb(0_113_227/0.3)]",
        className
      )}
    >
      <svg viewBox="0 0 512 512" className="size-full">
        <path d="M138 196 L236 362 L378 140" fill="none" stroke="#ffffff" strokeWidth="60" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="150" cy="120" r="36" fill="#a8d4ff" />
      </svg>
    </span>
  );
}

/** Mark + wordmark, for headers and the landing page. */
export function BrandLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <BrandMark className={cn("size-7", markClassName)} />
      <span>{APP_NAME}</span>
    </span>
  );
}
