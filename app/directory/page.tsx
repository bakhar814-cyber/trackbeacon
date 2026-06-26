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
      <h1 className="text-2xl font-bold">Directory</h1>
      <form className="mt-4 flex flex-wrap gap-2" action="/directory">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select name="sort" defaultValue={sort} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="recent">Recently changed</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">Go</button>
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(items as Item[] | null ?? []).map((it) => <ItemCard key={it.id} item={it} />)}
      </div>
      {(!items || items.length === 0) && (
        <p className="mt-8 text-center text-slate-400">
          Nothing here yet. Seed the directory with <code>npm run seed</code>, or{" "}
          <Link href="/login" className="text-accent underline">sign in</Link> to add trackers.
        </p>
      )}
    </div>
  );
}
