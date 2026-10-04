import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { ATTACHMENTS_BUCKET } from "@/lib/uploads/paths";

/**
 * Opens an attachment (e.g. a receipt photo): the row is read through RLS,
 * so only its owner gets anywhere, then the browser is redirected to a
 * 60-second signed URL. Storage paths are never exposed as public links.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: attachment } = await supabase.from("attachments").select("storage_path").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(attachment.storage_path, 60);
  if (!data?.signedUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const response = NextResponse.redirect(data.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
