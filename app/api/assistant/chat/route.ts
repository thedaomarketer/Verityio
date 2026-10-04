import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { getEntitlement } from "@/lib/data/subscription";
import { runAssistantTurn } from "@/lib/ai/chat";
import { getI18n } from "@/lib/i18n/server";
import { v, validationMessage } from "@/lib/i18n/validation";

const bodySchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1, v("messageRequired")).max(2000),
});

export async function POST(request: Request) {
  const [ctx, { locale, m }] = await Promise.all([requireUserContext(), getI18n()]);
  if (!ctx) {
    return NextResponse.json({ error: m.errors.mustSignIn }, { status: 401 });
  }
  if (!(await getEntitlement(ctx.userId)).premium) {
    return NextResponse.json({ error: m.errors.premiumRequired }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: validationMessage(m, parsed.error) }, { status: 400 });
  }

  const supabase = await createClient();

  const [{ data: profile }, { data: jobs }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle(),
    supabase.from("jobs").select("id, name").eq("user_id", ctx.userId).eq("is_active", true),
  ]);

  let conversationId = parsed.data.conversationId;

  if (conversationId) {
    const { data: existing } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: m.errors.conversationNotFound }, { status: 404 });
    }
  } else {
    const { data: conversation, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: ctx.userId, title: parsed.data.message.slice(0, 80) })
      .select("id")
      .single();
    if (error || !conversation) {
      return NextResponse.json({ error: m.errors.conversationStartFailed }, { status: 500 });
    }
    conversationId = conversation.id;
  }

  const { data: historyRows } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(40);

  const history = (historyRows ?? [])
    .filter((row): row is { role: "user" | "assistant"; content: string } => row.role === "user" || row.role === "assistant")
    .map((row) => ({ role: row.role, content: row.content }));

  let reply: string;
  try {
    reply = await runAssistantTurn({
      toolContext: {
        supabase,
        userId: ctx.userId,
        timezone: ctx.timezone,
        weekStartsOn: ctx.weekStartsOn,
        currency: ctx.currency,
      },
      fullName: profile?.full_name ?? null,
      locale,
      jobs: jobs ?? [],
      history,
      userMessage: parsed.data.message,
    });
  } catch (error) {
    console.error("Assistant turn failed", error);
    return NextResponse.json({ error: m.errors.assistantUnavailable }, { status: 502 });
  }

  await supabase.from("ai_messages").insert([
    { conversation_id: conversationId, user_id: ctx.userId, role: "user", content: parsed.data.message },
    { conversation_id: conversationId, user_id: ctx.userId, role: "assistant", content: reply },
  ]);

  return NextResponse.json({ conversationId, reply });
}
