import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { planFor } from "@/lib/plans";
import { TrackersTable } from "./trackers-table";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("plan").eq("id", user.id).single();
  const plan = planFor(profile?.plan);

  const { data: trackers } = await supabase
    .from("trackers")
    .select("id, active, notify_on, items(id, slug, title, current_price, currency, in_stock)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const used = trackers?.length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My trackers</h1>
        <Link href="/directory" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">
          + Add tracker
        </Link>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        <span>
          <strong>{used}</strong> of <strong>{plan.maxTrackers}</strong> trackers used ·{" "}
          <span className="text-slate-500">{plan.label} plan · checks {plan.checkIntervalMinutes >= 1440 ? "daily" : "hourly"}</span>
        </span>
        {used >= plan.maxTrackers && plan.label === "Free" && (
          <Link href="/pricing" className="font-semibold text-accent">Upgrade for more →</Link>
        )}
      </div>

      <div className="mt-6">
        <TrackersTable trackers={(trackers as any) ?? []} />
      </div>
    </div>
  );
}
