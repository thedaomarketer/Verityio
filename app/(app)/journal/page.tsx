import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { getI18n } from "@/lib/i18n/server";
import { CreateEntryDialog } from "@/components/journal/create-entry-dialog";
import { JournalTimeline } from "@/components/journal/journal-timeline";

export default async function JournalPage() {
  const [ctx, { m }] = await Promise.all([requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  const supabase = await createClient();
  const [{ data: entries }, { data: jobs }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("*, job:jobs(name, color)")
      .eq("user_id", ctx.userId)
      .order("event_at", { ascending: false })
      .limit(100),
    supabase.from("jobs").select("id, name").eq("user_id", ctx.userId).eq("is_active", true),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.journal.title}</h1>
          <p className="text-sm text-muted-foreground">{m.journal.subtitle}</p>
        </div>
        <CreateEntryDialog jobs={jobs ?? []} timezone={ctx.timezone} />
      </div>
      <JournalTimeline entries={entries ?? []} timezone={ctx.timezone} />
    </div>
  );
}
