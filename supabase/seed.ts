/**
 * Seed the directory with real items. Run: npm run seed
 *
 * It reads URLs from supabase/seed-urls.txt (one product URL per line),
 * scrapes each with the generic parser, and upserts into the DB via the
 * service-role key. Aim for 100–200 real items before launch (playbook day 11).
 *
 * Edit seed-urls.txt with product pages from the sources you'll track.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseProductHtml } from "../lib/scraper/parsers/generic";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

async function main() {
  // 1) Ensure a source exists.
  const { data: source } = await db
    .from("sources")
    .upsert({ name: "Seed source", niche: "demo", scrape_config: { parser: "generic" } }, { onConflict: "name" })
    .select()
    .single();

  // 2) Read URLs.
  let urls: string[] = [];
  try {
    urls = readFileSync(join(process.cwd(), "supabase/seed-urls.txt"), "utf8")
      .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  } catch {
    console.error("Create supabase/seed-urls.txt with one product URL per line.");
    process.exit(1);
  }

  let ok = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "TrackBeaconBot/1.0" } });
      const html = await res.text();
      const parsed = parseProductHtml(html);
      if (!parsed) { console.warn("skip (no data):", url); continue; }
      const slug = slugify(parsed.title) || slugify(url);
      const now = new Date().toISOString();

      const { data: item } = await db.from("items").upsert({
        source_id: source?.id,
        slug,
        title: parsed.title,
        image_url: parsed.image_url,
        product_url: url,
        current_price: parsed.price,
        currency: parsed.currency,
        in_stock: parsed.in_stock,
        last_checked_at: now,
        last_changed_at: now,
      }, { onConflict: "slug" }).select().single();

      if (item) {
        await db.from("price_history").insert({ item_id: item.id, price: parsed.price, in_stock: parsed.in_stock });
        ok++;
        console.log("seeded:", parsed.title);
      }
    } catch (e) {
      console.warn("error:", url, (e as Error).message);
    }
  }
  console.log(`\nDone. Seeded ${ok}/${urls.length} items.`);
}

main();
