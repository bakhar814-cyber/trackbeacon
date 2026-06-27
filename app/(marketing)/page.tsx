import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { niche } from "@/lib/niche.config";
import { formatPrice, timeAgo } from "@/lib/format";

export const revalidate = 300; // ISR: fresh "recent drops" every 5 min.

export default async function Landing() {
  const supabase = createPublicClient();
  const { data: recent } = await supabase
    .from("items")
    .select("slug,title,current_price,currency,in_stock,last_changed_at")
    .order("last_changed_at", { ascending: false, nullsFirst: false })
    .limit(6);

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://trackbeacon.online";
  const siteLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: niche.brand,
        url: site,
        description: niche.seo.description,
      },
      {
        "@type": "WebSite",
        name: niche.brand,
        url: site,
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${site}/directory?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }} />
      {/* HERO ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-6 py-20 text-center shadow-glow sm:py-24">
        {/* glowing depth orbs */}
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl animate-float-slow" />
        <div aria-hidden className="pointer-events-none absolute -right-20 top-8 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl animate-float-slower" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-violet-500/25 blur-3xl" />

        <div className="relative mx-auto max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
            👟 Free · instant restock &amp; price-drop alerts
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            {niche.hero.headline}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-300">{niche.hero.sub}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="btn-glow rounded-xl px-7 py-3.5 text-base font-semibold">
              {niche.hero.cta}
            </Link>
            <Link
              href="/directory"
              className="rounded-xl border border-white/20 bg-white/5 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              Browse the directory
            </Link>
          </div>
        </div>
      </section>

      {/* BENEFITS ------------------------------------------------------------ */}
      <section className="mt-8 grid gap-4 sm:grid-cols-3" style={{ perspective: "1200px" }}>
        {niche.benefits.map((b, i) => (
          <div key={i} className="card-3d glass rounded-2xl p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 font-bold text-white shadow-glow">
              {i + 1}
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{b}</p>
          </div>
        ))}
      </section>

      {/* RECENT -------------------------------------------------------------- */}
      <section className="mt-12">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent {niche.items}
        </h2>
        <div className="glass overflow-hidden rounded-2xl shadow-premium">
          {(recent ?? []).length === 0 && (
            <p className="p-6 text-sm text-slate-400">No items yet — seed the directory (npm run seed).</p>
          )}
          {(recent ?? []).map((it) => (
            <Link
              key={it.slug}
              href={`/item/${it.slug}`}
              className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 transition last:border-0 hover:bg-white/5"
            >
              <span className="truncate pr-4 font-medium text-slate-200">{it.title}</span>
              <span className="flex items-center gap-3 text-sm text-slate-400">
                <span className="font-bold text-white">{formatPrice(it.current_price, it.currency)}</span>
                <span className="hidden sm:inline">{timeAgo(it.last_changed_at)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
