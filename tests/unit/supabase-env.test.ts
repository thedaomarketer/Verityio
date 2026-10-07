import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabaseServiceRoleKey } from "@/lib/supabase/env";

describe("getSupabaseServiceRoleKey", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers SUPABASE_SERVICE_ROLE_KEY", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_x");
    expect(getSupabaseServiceRoleKey()).toBe("service-role");
  });

  it("falls back to SUPABASE_SECRET_KEY when the service-role key is empty", () => {
    // Production had SUPABASE_SERVICE_ROLE_KEY defined but blank.
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "  ");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_x");
    expect(getSupabaseServiceRoleKey()).toBe("sb_secret_x");
  });

  it("throws a clear error when neither is set", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(() => getSupabaseServiceRoleKey()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

describe("browser-visible Supabase settings", () => {
  it("reads NEXT_PUBLIC_ variables by literal name so Next.js can inline them into browser code", async () => {
    // A dynamic `process.env[name]` lookup is undefined in the browser, which
    // silently broke profile-photo and receipt uploads in production.
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("lib/supabase/env.ts", "utf8").replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/process\.env\[/);
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
});
