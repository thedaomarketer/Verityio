import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { getHolidayRegion } from "@/lib/data/holidays";
import { getI18n } from "@/lib/i18n/server";
import { ResourcesBrowser } from "@/components/resources/resources-browser";

export default async function ResourcesPage() {
  const [ctx, { m }] = await Promise.all([requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  // Default to the country saved under Pay & Taxes; Canada otherwise.
  const region = await getHolidayRegion(await createClient(), ctx.userId);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.resources.title}</h1>
        <p className="text-sm text-muted-foreground">{m.resources.subtitle}</p>
      </div>
      <ResourcesBrowser defaultCountry={region?.country ?? "CA"} />
    </div>
  );
}
