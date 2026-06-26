/**
 * THE ONE FILE YOU EDIT FIRST.
 *
 * Everything user-facing (copy, brand, SEO) flows from here so you can
 * re-skin the whole app for any niche by changing this object.
 *
 * The playbook's #1 rule: pick a niche where missing an update costs money
 * or time, and where an active community already complains "I missed it again".
 */
export const niche = {
  /** Brand shown in nav, emails, <title>. */
  brand: "TrackBeacon",

  /** The thing you track, lowercase singular, e.g. "sneaker", "card", "GPU". */
  item: "drop",
  /** Plural for headings. */
  items: "drops",

  /** Used across landing + SEO. Keep it concrete. */
  nicheName: "your niche",

  /** Landing hero. */
  hero: {
    headline: "Never miss a drop again",
    sub: "We watch the listings you care about and alert you the second a price drops, a restock lands, or a new listing appears — so you're first, not last.",
    cta: "Start tracking free",
  },

  /** Three benefit bullets on the landing page. */
  benefits: [
    "Instant alerts by email the moment something changes — no more refreshing 20 tabs.",
    "A live, always-current directory of every item we track, with full price history.",
    "Free to start. Upgrade only when you want more trackers and faster checks.",
  ],

  /** SEO defaults. */
  seo: {
    title: "TrackBeacon — restock & price-drop alerts",
    description:
      "Get instant alerts when prices drop or items restock. Live price history and an always-current directory.",
  },

  /** Affiliate tag appended to outbound buy links (optional). */
  affiliateTag: "" as string,
} as const;

export type Niche = typeof niche;
