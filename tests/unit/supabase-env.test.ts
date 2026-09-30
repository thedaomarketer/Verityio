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
