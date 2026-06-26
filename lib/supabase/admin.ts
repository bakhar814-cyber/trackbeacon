import { createClient } from "@supabase/supabase-js";

/**
 * SERVICE-ROLE client. Bypasses RLS. Use ONLY in trusted server contexts:
 * the cron job, the Stripe webhook, and the seed script. NEVER import this
 * into a Client Component.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
