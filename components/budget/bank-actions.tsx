"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { disconnectBankAction, syncBanksAction } from "@/lib/actions/bank";

export function RefreshBanksButton() {
  const { m } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await syncBanksAction();
            setError(result.error ?? null);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {pending ? m.budget.refreshing : m.budget.refresh}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function DisconnectBankButton({ itemId, bankName }: { itemId: string; bankName: string }) {
  const { m } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(fmt(m.budget.disconnectConfirm, { bank: bankName }))) return;
          startTransition(async () => {
            const result = await disconnectBankAction(itemId);
            setError(result.error ?? null);
            router.refresh();
          });
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Unlink />}
        {m.budget.disconnect}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
