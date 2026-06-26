import type { ChangeType } from "@/lib/types";
import { niche } from "@/lib/niche.config";

const LABEL: Record<ChangeType, string> = {
  price_drop: "Price dropped",
  restock: "Back in stock",
  new_listing: "New listing",
};

export function subjectFor(type: ChangeType, title: string) {
  return `${LABEL[type]}: ${title}`;
}

/** Clean, trustworthy email. Item image, old -> new, a buy button (your affiliate link). */
export function emailHtml(opts: {
  type: ChangeType;
  title: string;
  imageUrl: string | null;
  oldValue: string | null;
  newValue: string | null;
  buyUrl: string;
  currency?: string;
}) {
  const { type, title, imageUrl, oldValue, newValue, buyUrl } = opts;
  const cur = opts.currency ?? "USD";
  const money = (v: string | null) =>
    v == null ? "" : new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(Number(v));

  const delta =
    type === "price_drop" && oldValue && newValue
      ? `<p style="font-size:18px;margin:8px 0"><s style="color:#9ca3af">${money(oldValue)}</s> &rarr; <strong style="color:#16a34a">${money(newValue)}</strong></p>`
      : `<p style="font-size:18px;margin:8px 0"><strong style="color:#2563eb">${LABEL[type]}</strong></p>`;

  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px">${niche.brand} alert</p>
    ${imageUrl ? `<img src="${imageUrl}" alt="" width="120" style="border-radius:8px;float:left;margin-right:16px"/>` : ""}
    <h2 style="font-size:18px;margin:0 0 4px">${escapeHtml(title)}</h2>
    ${delta}
    <div style="clear:both"></div>
    <a href="${buyUrl}" style="display:inline-block;margin-top:16px;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Buy now &rarr;</a>
    <p style="font-size:12px;color:#9ca3af;margin-top:24px">You're getting this because you track this item on ${niche.brand}. Manage your trackers in your dashboard.</p>
  </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
