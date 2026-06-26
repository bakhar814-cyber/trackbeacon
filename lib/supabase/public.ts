import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Anon, cookie-FREE client for PUBLIC reads (landing, directory, item pages,
 * sitemap). Because it never touches cookies(), these pages can be statically
 * rendered / ISR-cached. RLS still applies (items/price_history are public-read).
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
