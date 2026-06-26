import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

// Stripe needs the raw body — disable Next's parsing.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e: any) {
    return NextResponse.json({ error: `Webhook signature failed: ${e.message}` }, { status: 400 });
  }

  const db = createAdminClient();

  async function setPlan(userId: string, plan: "free" | "pro", customerId?: string) {
    await db.from("users").update({ plan, ...(customerId ? { stripe_customer_id: customerId } : {}) }).eq("id", userId);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = s.metadata?.user_id;
      if (userId) {
        await setPlan(userId, "pro", s.customer as string);
        await db.from("subscriptions").insert({
          user_id: userId,
          stripe_sub_id: s.subscription as string,
          status: "active",
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      const active = sub.status === "active" || sub.status === "trialing";
      if (userId) {
        await setPlan(userId, active ? "pro" : "free");
        await db.from("subscriptions")
          .update({ status: sub.status, current_period_end: new Date(sub.current_period_end * 1000).toISOString() })
          .eq("stripe_sub_id", sub.id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
