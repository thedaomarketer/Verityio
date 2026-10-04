"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { fileNameFromDisposition } from "@/lib/download";
import { cn } from "@/lib/utils";

function isInstalledApp(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Downloads a file from one of our API routes without navigating away.
 * A plain link to the file replaces the whole page in the installed
 * (home-screen) app, leaving a blank screen with no way back; instead the
 * file is fetched in the background and handed to the share sheet (installed
 * app -> "Save to Files") or saved via a temporary link (browser).
 */
export function DownloadButton({
  href,
  fallbackName,
  children,
  variant = "outline",
  size = "sm",
  className,
}: {
  href: string;
  fallbackName: string;
  children: ReactNode;
  variant?: "outline" | "secondary" | "ghost" | "default";
  size?: "sm" | "default";
  className?: string;
}) {
  const { m } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(href, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? m.errors.downloadFailed);
        return;
      }
      const blob = await response.blob();
      const name = fileNameFromDisposition(response.headers.get("content-disposition"), fallbackName);
      const file = new File([blob], name, { type: blob.type || "application/octet-stream" });

      if (isInstalledApp() && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: name });
        } catch (shareError) {
          // Closing the share sheet isn't an error.
          if (!(shareError instanceof DOMException && shareError.name === "AbortError")) throw shareError;
        }
        return;
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setError(m.errors.downloadFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant={variant} size={size} onClick={download} disabled={busy} className={cn(className)}>
        {busy && <Loader2 className="animate-spin" />}
        {children}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
