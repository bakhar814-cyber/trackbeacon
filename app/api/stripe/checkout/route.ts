import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data: profile } = await supabase.from("users").select("stripe_customer_id").eq("id", user.id).single();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: profile?.stripe_customer_id || undefined,
      customer_email: profile?.stripe_customer_id ? undefined : user.email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID_PRO!, quantity: 1 }],
      success_url: `${site}/dashboard?upgraded=1`,
      cancel_url: `${site}/pricing`,
      // So the webhook can map the checkout back to our user.
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
    });
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
