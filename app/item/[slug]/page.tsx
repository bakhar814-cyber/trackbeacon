import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { StatusBadge } from "@/components/StatusBadge";
import { PriceChart } from "@/components/PriceChart";
import { TrackButton } from "@/components/TrackButton";
import { formatPrice, timeAgo } from "@/lib/format";
import { niche } from "@/lib/niche.config";
import type { Item, PricePoint } from "@/lib/types";

// Dynamic: we read the signed-in user to show "Tracking ✓". The page is still
// fully server-rendered (great for SEO); the per-item data is cached upstream.

async function getItem(slug: string) {
  const supabase = createPublicClient();
  const { data: item } = await supabase.from("items").select("*").eq("slug", slug).single();
  return item as Item | null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const item = await getItem(params.slug);
  if (!item) return { title: "Not found" };
  const title = `${item.title} — price & stock | ${niche.brand}`;
  const description = `Live price (${formatPrice(item.current_price, item.currency)}) and stock status for ${item.title}. Get alerted when it drops or restocks.`;
  const images = item.image_url ? [item.image_url] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/item/${item.slug}` },
    openGraph: { title, description, images, type: "website" },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function ItemPage({ params }: { params: { slug: string } }) {
  const pub = createPublicClient();
  const item = await getItem(params.slug);
  if (!item) notFound();

  const { data: history } = await pub
    .from("price_history")
    .select("price,in_stock,recorded_at")
    .eq("item_id", item.id)
    .order("recorded_at", { ascending: true })
    .limit(180);

  // Is the current user already tracking this? (cookie-based auth)
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let tracked = false;
  if (user) {
    const { data: t } = await supabase
      .from("trackers").select("id").eq("user_id", user.id).eq("item_id", item.id).maybeSingle();
    tracked = !!t;
  }

  // schema.org Product/Offer -> rich results + AI-answer citations (GEO).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.title,
    image: item.image_url ?? undefined,
    offers: {
      "@type": "Offer",
      price: item.current_price ?? undefined,
      priceCurrency: item.currency,
      availability: item.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: item.product_url ?? undefined,
    },
  };

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://trackbeacon.online";
  const priceStr = formatPrice(item.current_price, item.currency);
  const stockStr = item.in_stock ? "in stock" : "out of stock";
  const description = `${item.title} is currently ${priceStr} and ${stockStr}. TrackBeacon tracks the price and availability of the ${item.title} and sends you a free email the moment it restocks or drops in price — so you can buy at retail, not resale.`;
  const faqs = [
    { q: `How do I get a restock alert for the ${item.title}?`, a: `Create a free TrackBeacon account and tap "Track this" on this page. We'll email you the moment the ${item.title} is back in stock.` },
    { q: `What is the current price of the ${item.title}?`, a: `As of the last check, the ${item.title} is ${priceStr} (${stockStr}). See the price history chart for recent changes.` },
    { q: `How will I know when the ${item.title} drops in price?`, a: `TrackBeacon checks the price regularly and emails you instantly when it drops. It's free to start.` },
  ];
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site },
      { "@type": "ListItem", position: 2, name: "Directory", item: `${site}/directory` },
      { "@type": "ListItem", position: 3, name: item.title, item: `${site}/item/${item.slug}` },
    ],
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <div className="mx-auto max-w-2xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="flex flex-col gap-6 sm:flex-row">
        {item.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.title} className="h-48 w-48 rounded-xl object-cover" />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{item.title}</h1>
          <p className="mt-2 text-3xl font-bold">{formatPrice(item.current_price, item.currency)}</p>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge inStock={item.in_stock} />
            <span className="text-sm text-slate-400">checked {timeAgo(item.last_checked_at)}</span>
          </div>
          <div className="mt-4 flex gap-3">
            <TrackButton itemId={item.id} tracked={tracked} />
            {item.product_url && (
              <a
                href={item.product_url}
                target="_blank"
                rel="nofollow noopener"
                className="rounded-xl border border-white/20 px-4 py-2 font-medium text-slate-200 transition hover:bg-white/10"
              >
                View listing ↗
              </a>
            )}
          </div>
        </div>
      </div>

      <p className="mt-8 leading-relaxed text-slate-300">{description}</p>

      <section className="glass mt-8 rounded-2xl p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Price history</h2>
        <PriceChart points={(history as PricePoint[] | null) ?? []} />
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-bold">Frequently asked</h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <div key={f.q} className="glass rounded-2xl p-4">
              <h3 className="font-semibold text-slate-100">{f.q}</h3>
              <p className="mt-1.5 text-sm text-slate-300">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
