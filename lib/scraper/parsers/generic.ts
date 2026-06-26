import * as cheerio from "cheerio";
import type { ScrapeResult } from "@/lib/types";

/**
 * Generic parser: tries schema.org Product/Offer JSON-LD first (the most
 * reliable, niche-agnostic signal), then falls back to OpenGraph / meta tags.
 *
 * Most real e-commerce pages ship JSON-LD. When they don't, write a
 * per-source parser in this folder and point the source's scrape_config at it.
 */
export function parseProductHtml(html: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  // 1) JSON-LD Product/Offer ------------------------------------------------
  const blocks = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).contents().text())
    .get();

  for (const raw of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    const product = findProduct(data);
    if (product) {
      const offer = pickOffer(product.offers);
      const price = toNumber(offer?.price ?? offer?.lowPrice);
      const availability = String(offer?.availability ?? "").toLowerCase();
      return {
        title: String(product.name ?? "").trim() || "Untitled",
        price,
        currency: String(offer?.priceCurrency ?? "USD"),
        in_stock: availability.includes("instock") || availability.includes("in_stock"),
        image_url: firstImage(product.image),
      };
    }
  }

  // 2) Meta-tag fallback ----------------------------------------------------
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").first().text().trim() ||
    null;
  const image = $('meta[property="og:image"]').attr("content") || null;
  const priceMeta =
    $('meta[property="product:price:amount"]').attr("content") ||
    $('meta[property="og:price:amount"]').attr("content") ||
    null;
  const availMeta = (
    $('meta[property="product:availability"]').attr("content") ||
    $('meta[property="og:availability"]').attr("content") ||
    ""
  ).toLowerCase();

  if (title || priceMeta) {
    return {
      title: (title ?? "Untitled").trim(),
      price: toNumber(priceMeta),
      currency:
        $('meta[property="product:price:currency"]').attr("content") || "USD",
      in_stock: availMeta.includes("instock") || availMeta.includes("in stock"),
      image_url: image,
    };
  }

  return null;
}

// --- helpers ---------------------------------------------------------------

type AnyObj = Record<string, any>;

function findProduct(data: unknown): AnyObj | null {
  const queue: unknown[] = [data];
  while (queue.length) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      queue.push(...node);
    } else if (node && typeof node === "object") {
      const obj = node as AnyObj;
      const type = obj["@type"];
      const isProduct = Array.isArray(type)
        ? type.includes("Product")
        : type === "Product";
      if (isProduct) return obj;
      if (Array.isArray(obj["@graph"])) queue.push(...obj["@graph"]);
    }
  }
  return null;
}

function pickOffer(offers: unknown): AnyObj | null {
  if (!offers) return null;
  if (Array.isArray(offers)) return (offers[0] as AnyObj) ?? null;
  return offers as AnyObj;
}

function firstImage(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return firstImage(image[0]);
  if (typeof image === "object") return (image as AnyObj).url ?? null;
  return null;
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}
