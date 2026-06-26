import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planFor } from "@/lib/plans";

/**
 * Single endpoint for tracker mutations. Plan limits are enforced HERE
 * (server-side) — never trust the client. RLS is a second line of defense.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { itemId, trackerId, action } = body as {
    itemId?: string;
    trackerId?: string;
    action: "add" | "remove" | "pause" | "resume";
  };

  // --- ADD: gate on plan tracker limit ------------------------------------
  if (action === "add") {
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

    const { data: profile } = await supabase.from("users").select("plan").eq("id", user.id).single();
    const plan = planFor(profile?.plan);

    const { count } = await supabase
      .from("trackers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= plan.maxTrackers) {
      // 402 Payment Required -> client redirects to /pricing.
      return NextResponse.json({ error: "limit_reached", limit: plan.maxTrackers }, { status: 402 });
    }

    const { error } = await supabase
      .from("trackers")
      .insert({ user_id: user.id, item_id: itemId })
      .select()
      .single();
    // Ignore unique-violation (already tracking) as success.
    if (error && !error.message.includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  // --- REMOVE / PAUSE / RESUME: must own the tracker ----------------------
  if (action === "remove") {
    const filter = trackerId
      ? supabase.from("trackers").delete().eq("id", trackerId).eq("user_id", user.id)
      : supabase.from("trackers").delete().eq("item_id", itemId!).eq("user_id", user.id);
    const { error } = await filter;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "pause" || action === "resume") {
    if (!trackerId) return NextResponse.json({ error: "trackerId required" }, { status: 400 });
    const { error } = await supabase
      .from("trackers")
      .update({ active: action === "resume" })
      .eq("id", trackerId)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
