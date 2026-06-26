import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const supabase = createPublicClient();
  const { data: items } = await supabase
    .from("items").select("slug, last_changed_at").limit(5000);

  const itemUrls = (items ?? []).map((it) => ({
    url: `${site}/item/${it.slug}`,
    lastModified: it.last_changed_at ? new Date(it.last_changed_at) : new Date(),
  }));

  return [
    { url: site, lastModified: new Date() },
    { url: `${site}/directory`, lastModified: new Date() },
    { url: `${site}/pricing`, lastModified: new Date() },
    ...itemUrls,
  ];
}
