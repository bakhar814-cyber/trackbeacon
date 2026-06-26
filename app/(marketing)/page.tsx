import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { niche } from "@/lib/niche.config";
import { formatPrice, timeAgo } from "@/lib/format";

export const revalidate = 300; // ISR: fresh "recent drops" every 5 min.

export default async function Landing() {
  const supabase = createPublicClient();
  // Live "recent drops" feed = social proof + freshness (playbook section 6).
  const { data: recent } = await supabase
    .from("items")
    .select("slug,title,current_price,currency,in_stock,last_changed_at")
    .order("last_changed_at", { ascending: false, nullsFirst: false })
    .limit(6);

  return (
    <div>
      <section className="py-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{niche.hero.headline}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">{niche.hero.sub}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login" className="rounded-lg bg-accent px-6 py-3 font-semibold text-white hover:opacity-90">
            {niche.hero.cta}
          </Link>
          <Link href="/directory" className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold">
            Browse the directory
          </Link>
        </div>
        <ul className="mx-auto mt-10 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
          {niche.benefits.map((b, i) => (
            <li key={i} className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
              {b}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent {niche.items}</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {(recent ?? []).length === 0 && (
            <p className="p-6 text-sm text-slate-400">No items yet — seed the directory (npm run seed).</p>
          )}
          {(recent ?? []).map((it) => (
            <Link
              key={it.slug}
              href={`/item/${it.slug}`}
              className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"
            >
              <span className="truncate pr-4 font-medium">{it.title}</span>
              <span className="flex items-center gap-3 text-sm text-slate-500">
                <span className="font-semibold text-slate-900">{formatPrice(it.current_price, it.currency)}</span>
                <span>{timeAgo(it.last_changed_at)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
