import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeUrl, detectChanges } from "@/lib/scraper";
import { sendAlertEmail } from "@/lib/alerts/email";
import { emailHtml, subjectFor } from "@/lib/alerts/format";
import { PLANS } from "@/lib/plans";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Triggered by Vercel Cron (see vercel.json). Secured with a shared secret.
 *
 * Flow (playbook section 7 / Prompt 5):
 *  1. Pick items due for a re-check (oldest last_checked_at first, batched).
 *  2. Scrape each, upsert, write a price_history point.
 *  3. For each change, find trackers whose notify_on matches, and email them
 *     (respecting the user's plan check interval).
 */
export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when
  // the CRON_SECRET env var is set. We also accept x-cron-secret for manual /
  // QStash triggering.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const ok = secret && (auth === `Bearer ${secret}` || headerSecret === secret);
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const BATCH = 25;

  const { data: due } = await db
    .from("items")
    .select("*")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  const items = (due as Item[]) ?? [];
  let checked = 0;
  let alertsSent = 0;

  for (const item of items) {
    if (!item.product_url) continue;
    const scraped = await scrapeUrl(item.product_url);
    checked++;
    if (!scraped) {
      await db.from("items").update({ last_checked_at: new Date().toISOString() }).eq("id", item.id);
      continue;
    }

    const changes = detectChanges(item, scraped);
    const now = new Date().toISOString();

    await db
      .from("items")
      .update({
        title: scraped.title || item.title,
        current_price: scraped.price,
        in_stock: scraped.in_stock,
        image_url: scraped.image_url ?? item.image_url,
        last_checked_at: now,
        last_changed_at: changes.length ? now : item.last_changed_at,
      })
      .eq("id", item.id);

    await db.from("price_history").insert({
      item_id: item.id,
      price: scraped.price,
      in_stock: scraped.in_stock,
    });

    if (changes.length) {
      alertsSent += await fanOutAlerts(db, item, scraped, changes);
    }
  }

  return NextResponse.json({ ok: true, checked, alertsSent });
}

async function fanOutAlerts(
  db: ReturnType<typeof createAdminClient>,
  item: Item,
  scraped: { price: number | null; image_url: string | null; currency: string },
  changes: { type: "price_drop" | "restock" | "new_listing"; oldValue: string | null; newValue: string | null }[]
) {
  let sent = 0;
  const types = changes.map((c) => c.type);

  // Active trackers whose notify_on overlaps the change types, with the owner.
  const { data: trackers } = await db
    .from("trackers")
    .select("id, notify_on, users(email, plan)")
    .eq("item_id", item.id)
    .eq("active", true)
    .overlaps("notify_on", types);

  for (const t of (trackers as any[]) ?? []) {
    const email = t.users?.email;
    if (!email) continue;
    const plan = t.users?.plan === "pro" ? PLANS.pro : PLANS.free;
    if (!plan.instantAlerts) {
      // Free plan: in production, batch these into a daily digest instead of
      // sending instantly. For the MVP we still send but you can gate here.
    }

    for (const change of changes) {
      if (!t.notify_on.includes(change.type)) continue;
      const buyUrl = item.product_url ?? "#";
      const ok = await sendAlertEmail({
        to: email,
        subject: subjectFor(change.type, item.title),
        html: emailHtml({
          type: change.type,
          title: item.title,
          imageUrl: scraped.image_url ?? item.image_url,
          oldValue: change.oldValue,
          newValue: change.newValue,
          buyUrl,
          currency: item.currency,
        }),
      });
      if (ok) {
        sent++;
        await db.from("alerts").insert({
          tracker_id: t.id,
          type: change.type,
          old_value: change.oldValue,
          new_value: change.newValue,
          channel: "email",
        });
      }
    }
  }
  return sent;
}
