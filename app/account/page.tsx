import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { planFor } from "@/lib/plans";
import { SignOut } from "./sign-out";
import { ManageBilling } from "./manage-billing";

export const dynamic = "force-dynamic";

export default async function Account() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("users").select("plan").eq("id", user.id).single();
  const plan = planFor(profile?.plan);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Account</h1>
      <dl className="glass mt-6 space-y-3 rounded-2xl p-5 text-sm">
        <div className="flex justify-between"><dt className="text-slate-400">Email</dt><dd>{user.email}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-400">Plan</dt><dd className="font-medium">{plan.label}</dd></div>
      </dl>
      <div className="mt-4 flex gap-3">
        {plan.label === "Pro" && <ManageBilling />}
        <SignOut />
      </div>
    </div>
  );
}
