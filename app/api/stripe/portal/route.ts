import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("stripe_customer_id").eq("id", user.id).single();
  if (!profile?.stripe_customer_id) return NextResponse.json({ error: "no customer" }, { status: 400 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const portal = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${site}/account`,
  });
  return NextResponse.json({ url: portal.url });
}
