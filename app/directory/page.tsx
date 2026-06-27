import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { ItemCard } from "@/components/ItemCard";
import { niche } from "@/lib/niche.config";
import type { Item } from "@/lib/types";

export const revalidate = 300;
export const metadata = { title: `Directory — ${niche.brand}` };

export default async function Directory({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string };
}) {
  const supabase = createPublicClient();
  const q = searchParams.q?.trim();
  const sort = searchParams.sort ?? "recent";

  let query = supabase.from("items").select("*");
  if (q) query = query.ilike("title", `%${q}%`);
  if (sort === "price_asc") query = query.order("current_price", { ascending: true, nullsFirst: false });
  else if (sort === "price_desc") query = query.order("current_price", { ascending: false, nullsFirst: false });
  else query = query.order("last_changed_at", { ascending: false, nullsFirst: false });

  const { data: items } = await query.limit(60);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        The <span className="text-gradient">{niche.item}</span> directory
      </h1>
      <form className="mt-4 flex flex-wrap gap-2" action="/directory">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search…"
          className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-400/60 focus:bg-white/10"
        />
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none [&>option]:bg-slate-900"
        >
          <option value="recent">Recently changed</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
        <button className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold">Go</button>
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" style={{ perspective: "1200px" }}>
        {(items as Item[] | null ?? []).map((it) => <ItemCard key={it.id} item={it} />)}
      </div>
      {(!items || items.length === 0) && (
        <p className="mt-8 text-center text-slate-400">
          Nothing here yet. Seed the directory with <code>npm run seed</code>, or{" "}
          <Link href="/login" className="text-indigo-300 underline">sign in</Link> to add trackers.
        </p>
      )}
    </div>
  );
}
