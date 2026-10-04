"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { connectBankAction, createLinkTokenAction } from "@/lib/actions/bank";

const PLAID_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

interface PlaidHandler {
  open: () => void;
  destroy: () => void;
}

interface PlaidLinkMetadata {
  institution?: { name?: string | null; institution_id?: string | null } | null;
}

declare global {
  interface Window {
    Plaid?: {
      create: (config: {
        token: string;
        onSuccess: (publicToken: string, metadata: PlaidLinkMetadata) => void;
        onExit: () => void;
      }) => PlaidHandler;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

/** Loads Plaid Link once, on demand -- never on pages that don't need it. */
function loadPlaid(): Promise<void> {
  if (window.Plaid) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PLAID_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Plaid Link failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Opens Plaid Link. The flow: the server makes a short-lived link token,
 * the user picks their bank and signs in inside Plaid's window (Verityio
 * never sees the login), and the one-time public token goes back to the
 * server to be exchanged and stored encrypted.
 */
export function ConnectBankButton({ label }: { label?: string }) {
  const { m } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const result = await createLinkTokenAction();
      if (!result.linkToken) {
        setError(result.error ?? m.budget.connectFailed);
        setBusy(false);
        return;
      }
      await loadPlaid();
      const handler = window.Plaid!.create({
        token: result.linkToken,
        onSuccess: async (publicToken, metadata) => {
          const saved = await connectBankAction({
            publicToken,
            institutionId: metadata.institution?.institution_id ?? null,
            institutionName: metadata.institution?.name ?? null,
          });
          handler.destroy();
          setBusy(false);
          if (saved.error) setError(saved.error);
          else startTransition(() => router.refresh());
        },
        onExit: () => {
          handler.destroy();
          setBusy(false);
        },
      });
      handler.open();
    } catch {
      setError(m.budget.connectFailed);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={connect} disabled={busy} size="lg" className="w-full sm:w-auto">
        {busy ? <Loader2 className="animate-spin" /> : <Landmark />}
        {busy ? m.budget.connecting : (label ?? m.budget.connect)}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
