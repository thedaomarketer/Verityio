"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { logAudit } from "@/lib/audit/log";
import {
  ATTACHMENTS_BUCKET,
  isOwnAvatarPath,
  isOwnReceiptPath,
  MAX_UPLOAD_BYTES,
  RECEIPT_TYPES,
  splitPath,
} from "@/lib/uploads/paths";

export interface UploadActionResult {
  error?: string;
  success?: boolean;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Confirms the object really exists (the client uploaded it to its own folder under RLS). */
async function objectExists(supabase: Supabase, path: string): Promise<boolean> {
  const { folder, name } = splitPath(path);
  const { data } = await supabase.storage.from(ATTACHMENTS_BUCKET).list(folder, { search: name, limit: 1 });
  return Boolean(data?.some((object) => object.name === name));
}

/** Records a newly uploaded profile photo and removes the previous one. */
export async function saveAvatarAction(path: string): Promise<UploadActionResult> {
  const { m } = await getI18n();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };
  if (typeof path !== "string" || !isOwnAvatarPath(user.id, path) || !(await objectExists(supabase, path))) {
    return { error: m.errors.uploadFailed };
  }

  const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
  const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
  if (error) return { error: m.errors.uploadFailed };

  const previous = profile?.avatar_url;
  if (previous && previous !== path && isOwnAvatarPath(user.id, previous)) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([previous]);
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeAvatarAction(): Promise<UploadActionResult> {
  const { m } = await getI18n();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return { error: m.errors.uploadFailed };
  if (profile?.avatar_url && isOwnAvatarPath(user.id, profile.avatar_url)) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([profile.avatar_url]);
  }
  revalidatePath("/", "layout");
  return { success: true };
}

const receiptSchema = z.object({
  expenseId: z.uuid(),
  path: z.string().max(300),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(RECEIPT_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/** Attaches an uploaded receipt photo (or PDF) to one of the user's expenses. */
export async function addReceiptAction(input: z.input<typeof receiptSchema>): Promise<UploadActionResult> {
  const { m } = await getI18n();
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return { error: m.errors.uploadFailed };
  const { expenseId, path, fileName, mimeType, size } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  // Ownership: the expense must be readable through RLS, and the path must sit under it.
  const { data: expense } = await supabase.from("expenses").select("id, receipt_url").eq("id", expenseId).eq("user_id", user.id).maybeSingle();
  if (!expense || !isOwnReceiptPath(user.id, expenseId, path) || !(await objectExists(supabase, path))) {
    return { error: m.errors.uploadFailed };
  }

  const { data: attachment, error } = await supabase
    .from("attachments")
    .insert({ user_id: user.id, entity_type: "expense", entity_id: expenseId, file_name: fileName, storage_path: path, mime_type: mimeType, file_size: size })
    .select("id")
    .single();
  if (error || !attachment) return { error: m.errors.uploadFailed };

  // `receipt_url` marks "has a receipt" for lists (attachments are polymorphic, so lists can't join them).
  if (!expense.receipt_url) await supabase.from("expenses").update({ receipt_url: path }).eq("id", expenseId);
  await logAudit({ userId: user.id, entityType: "expense", entityId: expenseId, action: "updated" });

  revalidatePath("/expenses");
  return { success: true };
}

export async function deleteReceiptAction(attachmentId: string): Promise<UploadActionResult> {
  const { m } = await getI18n();
  if (!z.uuid().safeParse(attachmentId).success) return { error: m.errors.uploadFailed };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { data: attachment } = await supabase
    .from("attachments")
    .select("id, entity_id, storage_path")
    .eq("id", attachmentId)
    .eq("user_id", user.id)
    .eq("entity_type", "expense")
    .maybeSingle();
  if (!attachment) return { error: m.errors.uploadFailed };

  await supabase.storage.from(ATTACHMENTS_BUCKET).remove([attachment.storage_path]);
  await supabase.from("attachments").delete().eq("id", attachment.id);

  const { data: remaining } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("entity_type", "expense")
    .eq("entity_id", attachment.entity_id)
    .order("created_at")
    .limit(1);
  await supabase.from("expenses").update({ receipt_url: remaining?.[0]?.storage_path ?? null }).eq("id", attachment.entity_id);
  await logAudit({ userId: user.id, entityType: "expense", entityId: attachment.entity_id, action: "updated" });

  revalidatePath("/expenses");
  return { success: true };
}

/** Receipts for one expense, for the receipt sheet (ids only; files are served through /api/attachments). */
export async function listReceiptsAction(expenseId: string): Promise<{ id: string; fileName: string; mimeType: string | null }[]> {
  if (!z.uuid().safeParse(expenseId).success) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select("id, file_name, mime_type")
    .eq("entity_type", "expense")
    .eq("entity_id", expenseId)
    .order("created_at");
  return (data ?? []).map((a) => ({ id: a.id, fileName: a.file_name, mimeType: a.mime_type }));
}
