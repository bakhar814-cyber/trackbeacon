import { niche } from "@/lib/niche.config";

/**
 * Build an outbound "buy" link, routed through your affiliate program if one is
 * configured in niche.config.ts. Until you join a program it returns the plain
 * product URL (no commission). The moment you set `affiliateLinkTemplate` (or
 * `affiliateTag`), every buy link across the site + email alerts earns commission.
 */
export function buyUrl(productUrl: string | null | undefined): string {
  const url = productUrl || "#";
  if (url === "#") return url;

  // Preferred: a deep-link template from an affiliate network, e.g.
  // "https://go.skimresources.com/?id=XXXX&xs=1&url={url}"
  const tpl = (niche.affiliateLinkTemplate || "").trim();
  if (tpl.includes("{url}")) return tpl.replace("{url}", encodeURIComponent(url));

  // Fallback: append a query param tag like "tag=yourid-20" to the product URL.
  const tag = (niche.affiliateTag || "").trim();
  if (tag.includes("=")) {
    try {
      const u = new URL(url);
      const i = tag.indexOf("=");
      u.searchParams.set(tag.slice(0, i), tag.slice(i + 1));
      return u.toString();
    } catch {
      return url;
    }
  }
  return url;
}
