export function formatPrice(price: number | null, currency = "USD") {
  if (price == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
}

export function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
