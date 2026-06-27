import { prisma } from "@/lib/db";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { PageHeader, SectionTitle } from "@/components/ui/SectionTitle";
import { Stat } from "@/components/ui/Stat";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatNumber, formatUsd, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

const SUBS_GOAL = 1000;
const WATCH_HOURS_GOAL = 4000;
const DEFAULT_RPM = 2.5; // USD per 1000 views, fallback model

// Static catalogue of additional revenue streams. Recommendations from the DB
// (area="revenue") are merged in below when present.
const OPPORTUNITIES: { key: string; title: string; rec: string }[] = [
  { key: "sponsorships", title: "Sponsorships", rec: "Pitch kid-friendly brands once you pass 10k subs; integrate a 15s segment." },
  { key: "affiliate", title: "Affiliate", rec: "Link toy/book bundles featured in episodes via affiliate programs." },
  { key: "merch", title: "Merch", rec: "Plush + apparel of lead characters; launch a print-on-demand store." },
  { key: "digital", title: "Digital products", rec: "Sell coloring books, activity packs and printable storybooks." },
  { key: "licensing", title: "Licensing", rec: "License characters & episodes to streaming/education platforms." },
  { key: "memberships", title: "Channel memberships", rec: "Offer early access + bonus shorts to paying members." },
  { key: "superthanks", title: "Super Thanks", rec: "Enable Super Thanks to let fans tip on high-engagement uploads." },
];

export default async function MonetizationPage() {
  const [latest, snapshots, revenueRecs] = await Promise.all([
    prisma.channelStat.findFirst({ orderBy: { capturedAt: "desc" } }),
    prisma.analyticsSnapshot.findMany({ orderBy: { capturedAt: "desc" }, take: 90 }),
    prisma.recommendation.findMany({
      where: { area: "revenue", applied: false },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const subs = latest?.subscribers ?? 0;
  const watchHours = latest?.watchTimeHours ?? 0;
  const monetized = latest?.monetized ?? false;

  const subsPct = Math.min(100, (subs / SUBS_GOAL) * 100);
  const watchPct = Math.min(100, (watchHours / WATCH_HOURS_GOAL) * 100);
  const eligible = subs >= SUBS_GOAL && watchHours >= WATCH_HOURS_GOAL;

  // Estimated monthly revenue: trailing 30 views * RPM/1000.
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const recent = snapshots.filter((s) => s.capturedAt >= monthAgo);
  const monthlyViews = recent.reduce((a, s) => a + s.views, 0);
  const observedRpm = avg(recent.map((s) => s.rpmUsd).filter((r) => r > 0));
  const rpm = observedRpm > 0 ? observedRpm : DEFAULT_RPM;
  const estMonthlyRevenue = (monthlyViews / 1000) * rpm;

  return (
    <div className="space-y-8 pb-20 lg:pb-8">
      <PageHeader
        title="Monetization"
        subtitle="YouTube Partner Program progress and revenue diversification."
      />

      {/* YPP progress */}
      <section>
        <SectionTitle
          title="YouTube Partner Program"
          subtitle="Eligibility requires 1,000 subscribers and 4,000 public watch hours (rolling 12 months)."
          action={
            monetized ? (
              <Badge tone="good" dot>Monetized</Badge>
            ) : eligible ? (
              <Badge tone="brand" dot>Eligible — apply now</Badge>
            ) : (
              <Badge tone="warn" dot>In progress</Badge>
            )
          }
        />
        {!latest ? (
          <Card><EmptyState title="No channel stats yet" hint="Connect the channel to track YPP progress." /></Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Subscribers" subtitle={`${formatNumber(subs)} / ${formatNumber(SUBS_GOAL)}`} />
              <ProgressBar value={subs} max={SUBS_GOAL} tone={subs >= SUBS_GOAL ? "good" : "brand"} showValue />
              <p className="mt-2 text-xs text-slate-500">
                {subs >= SUBS_GOAL ? "Subscriber goal reached." : `${formatNumber(SUBS_GOAL - subs)} subscribers to go.`}
              </p>
            </Card>
            <Card>
              <CardHeader title="Watch hours" subtitle={`${formatNumber(watchHours)} / ${formatNumber(WATCH_HOURS_GOAL)}`} />
              <ProgressBar value={watchHours} max={WATCH_HOURS_GOAL} tone={watchHours >= WATCH_HOURS_GOAL ? "good" : "accent"} showValue />
              <p className="mt-2 text-xs text-slate-500">
                {watchHours >= WATCH_HOURS_GOAL ? "Watch-hour goal reached." : `${formatNumber(WATCH_HOURS_GOAL - watchHours)} hours to go.`}
              </p>
            </Card>
          </div>
        )}
      </section>

      {/* Revenue estimate */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Est. monthly revenue" value={formatUsd(estMonthlyRevenue)} accent="good" hint="views × RPM (trailing 30d)" />
        <Stat label="Monthly views" value={formatNumber(monthlyViews, { compact: true })} accent="brand" />
        <Stat label="Effective RPM" value={formatUsd(rpm)} accent="accent" hint={observedRpm > 0 ? "observed" : "model default"} />
        <Stat label="Subscribers" value={formatNumber(subs, { compact: true })} accent="warn" hint={formatPct(subsPct) + " to goal"} />
      </div>

      {/* AI revenue recommendations */}
      {revenueRecs.length > 0 && (
        <section>
          <SectionTitle title="AI revenue recommendations" />
          <div className="grid gap-4 sm:grid-cols-2">
            {revenueRecs.map((r) => (
              <Card key={r.id} hover className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone="good">revenue</Badge>
                  <StatusBadge status={r.impact} kind="impact" />
                </div>
                <p className="text-sm font-medium text-slate-100">{r.title}</p>
                <p className="mt-1 text-xs text-slate-500">{r.detail}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Opportunity catalogue */}
      <section>
        <SectionTitle title="Revenue opportunities" subtitle="Diversify beyond ad revenue." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OPPORTUNITIES.map((o) => (
            <Card key={o.key} hover className="p-4">
              <h3 className="mb-1 font-medium text-white">{o.title}</h3>
              <p className="text-sm text-slate-400">{o.rec}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
