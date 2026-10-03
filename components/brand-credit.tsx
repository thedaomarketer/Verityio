import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { APP_NAME, BUILT_BY, TRADEMARK_OWNER } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** "Built by DAO · Verityio™ is a trademark of Nexora Digital Systems." */
export async function BrandCredit({ className }: { className?: string }) {
  const { m } = await getI18n();
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      <span>{fmt(m.common.builtBy, { name: BUILT_BY })}</span>
      <span aria-hidden="true"> · </span>
      <span>{fmt(m.common.trademark, { app: APP_NAME, owner: TRADEMARK_OWNER })}</span>
    </p>
  );
}
