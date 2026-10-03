"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { validationMessage } from "@/lib/i18n/validation";
import { formText } from "@/lib/validation/form";
import { logAudit } from "@/lib/audit/log";
import { requireUserContext } from "@/lib/data/context";
import { localDateTimeToInstant } from "@/lib/calculations";
import { journalEntrySchema } from "@/lib/validation/journal";
import type { EntryType } from "@/lib/supabase/database.types";

export interface ActionResult {
  error?: string;
}

export async function createJournalEntryAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = journalEntrySchema.safeParse({
    entryType: formData.get("entryType"),
    jobId: formText(formData, "jobId"),
    title: formText(formData, "title"),
    content: formText(formData, "content"),
    eventAt: formData.get("eventAt"),
  });

  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const ctx = await requireUserContext();
  if (!ctx) return { error: m.errors.mustSignIn };
  const user = { id: ctx.userId };

  // "yyyy-mm-ddThh:mm" from a datetime-local input, in the user's zone.
  const [eventDate, eventTime] = parsed.data.eventAt.split("T");
  const eventAt = localDateTimeToInstant(eventDate, eventTime.slice(0, 5), ctx.timezone);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      user_id: user.id,
      job_id: parsed.data.jobId || null,
      entry_type: parsed.data.entryType as EntryType,
      title: parsed.data.title || null,
      content: parsed.data.content || null,
      event_at: eventAt.toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return { error: m.errors.entrySaveFailed };
  }

  await logAudit({ userId: user.id, entityType: "journal_entry", entityId: data.id, action: "created" });

  revalidatePath("/journal");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteJournalEntryAction(entryId: string): Promise<ActionResult> {
  const { m } = await getI18n();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { data: before } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("id", entryId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("journal_entries").delete().eq("id", entryId).eq("user_id", user.id);
  if (error) return { error: m.errors.entryDeleteFailed };

  await logAudit({
    userId: user.id,
    entityType: "journal_entry",
    entityId: entryId,
    action: "deleted",
    oldData: before,
  });

  revalidatePath("/journal");
  revalidatePath("/dashboard");
  return {};
}
