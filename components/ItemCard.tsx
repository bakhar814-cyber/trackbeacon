import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { formatPrice } from "@/lib/format";
import type { Item } from "@/lib/types";

export function ItemCard({ item }: { item: Item }) {
  return (
    <Link
      href={`/item/${item.slug}`}
      className="card-3d glass group block overflow-hidden rounded-2xl p-4"
    >
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt=""
              className="h-16 w-16 object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-800">{item.title}</p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">
            {formatPrice(item.current_price, item.currency)}
          </p>
          <div className="mt-1.5">
            <StatusBadge inStock={item.in_stock} />
          </div>
        </div>
      </div>
    </Link>
  );
}
