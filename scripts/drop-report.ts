/**
 * Weekly "[NICHE] Drop Report" generator (playbook Prompt 9 / section 15).
 * Pulls the last 7 days of price_history changes and, if an LLM key is set,
 * drafts a markdown report + 3 TikTok hooks + 1 tweet. Run: npm run drop-report
 *
 * Without an LLM key it still prints the raw data so you always have content.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();

  // Biggest drops in the last 7 days: join price_history -> items.
  const { data } = await db
    .from("price_history")
    .select("price, recorded_at, items(title, slug, current_price, currency)")
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(200);

  const rows = (data as any[]) ?? [];
  const lines = rows
    .filter((r) => r.items?.current_price != null && r.price != null && r.items.current_price < r.price)
    .slice(0, 15)
    .map((r) => `- ${r.items.title}: ${r.price} -> ${r.items.current_price} ${r.items.currency} (/item/${r.items.slug})`);

  const raw = lines.length ? lines.join("\n") : "No drops recorded in the last 7 days.";

  const prompt = `You write a punchy weekly "Drop Report" newsletter. Using ONLY this data, write:
1) a short markdown newsletter (intro + the drops as a list),
2) 3 TikTok hooks,
3) 1 tweet.
Keep it factual, no fluff.

DATA:
${raw}`;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("# Raw drops (no ANTHROPIC_API_KEY set)\n\n" + raw +
      "\n\n--- Paste the prompt below into Claude to generate the report ---\n\n" + prompt);
    return;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json();
  console.log(json.content?.map((c: any) => c.text).join("\n") ?? json);
}

main();
