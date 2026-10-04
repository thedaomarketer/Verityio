"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n/client";
import { deleteReceiptAction, listReceiptsAction } from "@/lib/actions/attachments";
import { cn } from "@/lib/utils";
import { uploadReceipt } from "./upload-receipt";

type Receipt = Awaited<ReturnType<typeof listReceiptsAction>>[number];

/** Receipt photos for one expense: view, add (camera or library), delete. */
export function ReceiptSheet({
  userId,
  expenseId,
  hasReceipt,
  title,
}: {
  userId: string;
  expenseId: string;
  hasReceipt: boolean;
  title: string;
}) {
  const { m } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function load() {
    setReceipts(await listReceiptsAction(expenseId));
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const error = await uploadReceipt(userId, expenseId, file);
      if (error) toast.error(error === "tooLarge" ? m.uploads.tooLarge : error === "unsupported" ? m.uploads.unsupported : m.errors.uploadFailed);
    }
    if (input.current) input.current.value = "";
    await load();
    setBusy(false);
    startTransition(() => router.refresh());
  }

  async function remove(id: string) {
    if (!window.confirm(m.uploads.deleteReceiptConfirm)) return;
    setBusy(true);
    const result = await deleteReceiptAction(id);
    if (result.error) toast.error(result.error);
    await load();
    setBusy(false);
    startTransition(() => router.refresh());
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={hasReceipt ? m.uploads.viewReceipts : m.uploads.addReceiptPhoto}
          className={cn(hasReceipt ? "text-primary" : "text-muted-foreground")}
        >
          {hasReceipt ? <Paperclip className="size-4" /> : <Camera className="size-4" />}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-w-xl pb-[max(1.25rem,env(safe-area-inset-bottom))] md:rounded-t-3xl">
        <SheetHeader className="px-5 pt-1 pb-0">
          <SheetTitle className="text-xl font-bold tracking-tight">{m.uploads.receiptsTitle}</SheetTitle>
          <SheetDescription className="truncate">{title}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-5">
          {receipts === null ? (
            <div className="flex h-28 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : receipts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{m.uploads.noReceipts}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {receipts.map((receipt) => (
                <li key={receipt.id} className="relative">
                  <a
                    href={`/api/attachments/${receipt.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-[3/4] overflow-hidden rounded-xl bg-secondary"
                    aria-label={`${m.uploads.openReceipt}: ${receipt.fileName}`}
                  >
                    {receipt.mimeType === "application/pdf" ? (
                      <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted-foreground">
                        <FileText className="size-6" />
                        <span className="line-clamp-2 break-all">{receipt.fileName}</span>
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- private signed URL via redirect.
                      <img src={`/api/attachments/${receipt.id}`} alt="" className="size-full object-cover" loading="lazy" />
                    )}
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(receipt.id)}
                    disabled={busy}
                    aria-label={m.uploads.deleteReceipt}
                    className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <Camera />}
            {busy ? m.uploads.uploading : m.uploads.addReceiptPhoto}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{m.uploads.privateNote}</p>
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => onFiles(event.target.files)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
