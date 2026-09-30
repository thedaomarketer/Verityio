import "server-only";

export function getAnthropicApiKey(): string {
  const value = process.env.ANTHROPIC_API_KEY;
  if (!value) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. Add it to .env.local (and to your Vercel project's " +
        "environment variables in production) to enable the AI assistant."
    );
  }
  return value;
}

/** Whether the assistant can run at all (the page shows a setup notice instead of a chat that can only fail). */
export function isAssistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}
