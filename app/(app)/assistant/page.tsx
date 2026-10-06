import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { getI18n } from "@/lib/i18n/server";
import { AssistantChat, type ChatMessage } from "@/components/assistant/chat";
import { isAssistantConfigured } from "@/lib/ai/env";
import { hasFeature } from "@/lib/data/subscription";
import { PremiumUpsell } from "@/components/premium/premium-upsell";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default async function AssistantPage() {
  const [ctx, { m }] = await Promise.all([requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  if (!isAssistantConfigured()) {
    return (
      <div className="space-y-4">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.assistant.title}</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Sparkles className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">{m.assistant.notConfigured}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!(await hasFeature(ctx.userId, "assistant"))) {
    return (
      <div className="space-y-4">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.assistant.title}</h1>
        <PremiumUpsell feature="assistant" />
      </div>
    );
  }

  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("user_id", ctx.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let initialMessages: ChatMessage[] = [];
  if (conversation) {
    const { data: rows } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(40);

    initialMessages = (rows ?? [])
      .filter((r): r is { role: "user" | "assistant"; content: string } => r.role === "user" || r.role === "assistant")
      .map((r) => ({ role: r.role, content: r.content }));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.assistant.title}</h1>
      <AssistantChat
        initialConversationId={conversation?.id ?? null}
        initialMessages={initialMessages}
      />
    </div>
  );
}
