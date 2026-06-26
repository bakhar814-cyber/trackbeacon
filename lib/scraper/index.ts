import { parseProductHtml } from "./parsers/generic";
import type { DetectedChange, Item, ScrapeResult } from "@/lib/types";

/**
 * Fetch one product URL and return a normalized ScrapeResult.
 *
 * Uses fetch + cheerio (works for server-rendered pages, which is most of them).
 * WHEN YOU NEED PLAYWRIGHT: if the price/stock only appears after client-side
 * JS runs (the HTML you get back has no price in it), this returns null. In
 * that case run Playwright on a small worker (a $5 Fly/Railway box) and post
 * the rendered HTML into parseProductHtml. Prefer official JSON feeds/APIs over
 * either — far more reliable than HTML scraping.
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; TrackBeaconBot/1.0; +https://yourdomain.com/bot)",
      Accept: "text/html,application/xhtml+xml",
    },
    // Be a good citizen — short timeout, no caching.
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn(`[scraper] ${url} -> HTTP ${res.status}`);
    return null;
  }
  const html = await res.text();
  return parseProductHtml(html);
}

/**
 * Compare a fresh scrape against the stored item and return the changes that
 * matter for alerting. Resilient to missing fields (null price won't fire).
 */
export function detectChanges(prev: Item, next: ScrapeResult): DetectedChange[] {
  const changes: DetectedChange[] = [];

  // Price drop
  if (
    prev.current_price != null &&
    next.price != null &&
    next.price < prev.current_price
  ) {
    changes.push({
      type: "price_drop",
      oldValue: String(prev.current_price),
      newValue: String(next.price),
    });
  }

  // Restock: was out, now in.
  if (!prev.in_stock && next.in_stock) {
    changes.push({ type: "restock", oldValue: "out_of_stock", newValue: "in_stock" });
  }

  return changes;
}
