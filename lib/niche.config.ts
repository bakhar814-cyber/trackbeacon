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
  item: "sneaker",
  /** Plural for headings. */
  items: "sneakers",

  /** Used across landing + SEO. Keep it concrete. */
  nicheName: "hyped sneakers",

  /** Landing hero. */
  hero: {
    headline: "Never miss a sneaker drop again",
    sub: "We watch the sneakers you want and ping you the second they restock, drop in price, or relist — so you cop at retail instead of paying resale.",
    cta: "Start tracking free",
  },

  /** Three benefit bullets on the landing page. */
  benefits: [
    "Instant email alerts the moment a pair restocks or drops in price — stop refreshing SNKRS and 20 retailer tabs.",
    "A live directory of every sneaker we track, with full price history so you can tell a real deal from the hype.",
    "Free to start. Upgrade for more trackers, hourly checks, and instant alerts when seconds decide who cops.",
  ],

  /** SEO defaults. */
  seo: {
    title: "TrackBeacon — sneaker restock & price-drop alerts",
    description:
      "Get instant alerts when sneakers restock or drop in price. Live price history and an always-current directory of hyped releases — cop at retail, not resale.",
  },

  /** Affiliate tag appended to outbound buy links (optional). */
  affiliateTag: "" as string,
} as const;

export type Niche = typeof niche;
