-- The Supabase security linter flags any SECURITY DEFINER function that signed-in
-- users can call over /rest/v1/rpc. Claiming a device's subscription id now
-- happens in a server action instead (lib/actions/push.ts), which verifies the
-- session with auth.getUser() and then writes with the admin client.
drop function if exists public.claim_push_subscription(text, text);
