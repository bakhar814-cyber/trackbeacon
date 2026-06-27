import { prisma } from "../db";

// MONETIZATION ASSISTANT — track progress to the YouTube Partner Program and
// estimate revenue from current analytics + growth trend, plus surface extra
// revenue streams.

export const YPP_SUBS_REQUIRED = 1000;
export const YPP_WATCH_HOURS_REQUIRED = 4000;

export interface MonetizationStatus {
  subscribers: number;
  watchHours: number;
  subsProgress: number; // 0..1
  watchProgress: number; // 0..1
  eligible: boolean;
  monetized: boolean;
  etaDays: number | null;
  estMonthlyRevenueUsd: number;
  streams: Array<{ name: string; status: string; note: string }>;
}

export async function getMonetizationStatus(): Promise<MonetizationStatus> {
  const stats = await prisma.channelStat.findMany({
    orderBy: { capturedAt: "desc" },
    take: 8,
  });
  const latest = stats[0];
  const subscribers = latest?.subscribers ?? 0;
  const watchHours = latest?.watchTimeHours ?? 0;

  // Growth rate from the oldest to newest sample in the window.
  const oldest = stats.at(-1);
  let subsPerDay = 0;
  let hoursPerDay = 0;
  if (oldest && latest && oldest !== latest) {
    const days = Math.max(
      1,
      (latest.capturedAt.getTime() - oldest.capturedAt.getTime()) / 86400000,
    );
    subsPerDay = (subscribers - oldest.subscribers) / days;
    hoursPerDay = (watchHours - oldest.watchTimeHours) / days;
  }

  const daysToSubs =
    subscribers >= YPP_SUBS_REQUIRED || subsPerDay <= 0
      ? subscribers >= YPP_SUBS_REQUIRED
        ? 0
        : null
      : Math.ceil((YPP_SUBS_REQUIRED - subscribers) / subsPerDay);
  const daysToHours =
    watchHours >= YPP_WATCH_HOURS_REQUIRED || hoursPerDay <= 0
      ? watchHours >= YPP_WATCH_HOURS_REQUIRED
        ? 0
        : null
      : Math.ceil((YPP_WATCH_HOURS_REQUIRED - watchHours) / hoursPerDay);

  const etaDays =
    daysToSubs === null || daysToHours === null
      ? null
      : Math.max(daysToSubs, daysToHours);

  // Estimate monthly revenue from recent per-episode RPM and view velocity.
  const recent = await prisma.analyticsSnapshot.findMany({
    orderBy: { capturedAt: "desc" },
    take: 30,
  });
  const avgRpm = recent.length
    ? recent.reduce((a, r) => a + r.rpmUsd, 0) / recent.length
    : 2;
  // Rough monthly view estimate: ~20% of lifetime views recur monthly while the
  // channel is in its growth phase. Replace with real YouTube data in live mode.
  const monthlyViews = (latest?.totalViews ?? 0) * 0.2;
  const estMonthlyRevenueUsd = (monthlyViews / 1000) * avgRpm;

  const eligible = subscribers >= YPP_SUBS_REQUIRED && watchHours >= YPP_WATCH_HOURS_REQUIRED;

  return {
    subscribers,
    watchHours,
    subsProgress: Math.min(1, subscribers / YPP_SUBS_REQUIRED),
    watchProgress: Math.min(1, watchHours / YPP_WATCH_HOURS_REQUIRED),
    eligible,
    monetized: latest?.monetized ?? false,
    etaDays,
    estMonthlyRevenueUsd,
    streams: revenueStreams(subscribers, eligible),
  };
}

function revenueStreams(subs: number, eligible: boolean) {
  return [
    {
      name: "YouTube Partner Program (ads)",
      status: eligible ? "ready to apply" : "in progress",
      note: "Primary income. Apply as soon as you hit 1,000 subs + 4,000 watch hours.",
    },
    {
      name: "Channel Memberships",
      status: subs >= 500 ? "available soon" : "locked",
      note: "Offer members-only bonus episodes, coloring pages, and badges.",
    },
    {
      name: "Super Thanks / Super Chat",
      status: eligible ? "enable after YPP" : "after monetization",
      note: "Let parents tip on favorite episodes once monetized.",
    },
    {
      name: "Sponsorships",
      status: subs >= 5000 ? "pursue now" : "build audience first",
      note: "Kid-safe brands (toys, books, learning apps) pay per integration.",
    },
    {
      name: "Affiliate marketing",
      status: "available",
      note: "Link to parent-approved books/toys featured in episodes.",
    },
    {
      name: "Merchandise",
      status: subs >= 2000 ? "launch" : "design now",
      note: "Plush toys, t-shirts and stickers of Pip & Bramble.",
    },
    {
      name: "Digital products",
      status: "available",
      note: "Printable activity packs, coloring books, bedtime story PDFs.",
    },
    {
      name: "Character licensing",
      status: subs >= 50000 ? "explore" : "long-term",
      note: "License original characters for apps, books and toys.",
    },
  ];
}
