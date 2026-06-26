import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { formatPrice } from "@/lib/format";
import type { Item } from "@/lib/types";

export function ItemCard({ item }: { item: Item }) {
  return (
    <Link
      href={`/item/${item.slug}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-md"
    >
      <div className="flex gap-3">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-lg bg-slate-100" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.title}</p>
          <p className="mt-1 text-lg font-semibold">{formatPrice(item.current_price, item.currency)}</p>
          <div className="mt-1"><StatusBadge inStock={item.in_stock} /></div>
        </div>
      </div>
    </Link>
  );
}
