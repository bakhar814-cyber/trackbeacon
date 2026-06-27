import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { PageHeader, SectionTitle } from "@/components/ui/SectionTitle";
import { Stat } from "@/components/ui/Stat";
import { LineChartCard } from "@/components/charts/LineChartCard";
import { formatNumber, formatPct, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const PERF_AREAS = ["titles", "thumbnails", "pacing", "length", "schedule"];

export default async function AnalyticsPage() {
  const [snapshots, channelStats, episodes, recommendations] = await Promise.all([
    prisma.analyticsSnapshot.findMany({ orderBy: { capturedAt: "asc" }, take: 365 }),
    prisma.channelStat.findMany({ orderBy: { capturedAt: "asc" }, take: 365 }),
    prisma.episode.findMany({
      where: { analytics: { some: {} } },
      include: { analytics: true },
    }),
    prisma.recommendation.findMany({
      where: { area: { in: PERF_AREAS }, applied: false },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  // Aggregate snapshots by capture day for time-series charts.
  const daily = aggregateByDay(snapshots);

  const totalViews = snapshots.reduce((a, s) => a + s.views, 0);
  const totalWatchMin = snapshots.reduce((a, s) => a + s.watchTimeMin, 0);
  const avgCtr = avg(snapshots.map((s) => s.ctr));
  const avgRetention = avg(snapshots.map((s) => s.avgViewPct));

  const subsSeries = channelStats.map((c) => ({
    label: formatDate(c.capturedAt),
    subscribers: c.subscribers,
  }));

  // Best-performing episodes by total views.
  const ranked = episodes
    .map((ep) => {
      const views = ep.analytics.reduce((a, s) => a + s.views, 0);
      const watchMin = ep.analytics.reduce((a, s) => a + s.watchTimeMin, 0);
      const ctr = avg(ep.analytics.map((s) => s.ctr));
      const retention = avg(ep.analytics.map((s) => s.avgViewPct));
      return { ep, views, watchMin, ctr, retention };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  return (
    <div className="space-y-8 pb-20 lg:pb-8">
      <PageHeader title="Analytics" subtitle="Channel performance and AI-driven optimization." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total views" value={formatNumber(totalViews, { compact: true })} accent="brand" />
        <Stat label="Watch time" value={`${formatNumber(Math.round(totalWatchMin / 60), { compact: true })}h`} accent="accent" />
        <Stat label="Avg CTR" value={formatPct(avgCtr, { fraction: true })} accent="good" />
        <Stat label="Avg retention" value={formatPct(avgRetention, { fraction: true })} accent="warn" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Views over time" />
          <LineChartCard
            data={daily}
            xKey="label"
            series={[{ key: "views", name: "Views", color: "#7c5cff" }]}
            yFormat="compact"
          />
        </Card>
        <Card>
          <CardHeader title="Watch time (minutes)" />
          <LineChartCard
            data={daily}
            xKey="label"
            series={[{ key: "watchTimeMin", name: "Watch min", color: "#22d3ee" }]}
            yFormat="compact"
          />
        </Card>
        <Card>
          <CardHeader title="CTR & retention" subtitle="Percentages" />
          <LineChartCard
            data={daily}
            xKey="label"
            series={[
              { key: "ctrPct", name: "CTR %", color: "#34d399" },
              { key: "retentionPct", name: "Retention %", color: "#fbbf24" },
            ]}
            yFormat="percent"
          />
        </Card>
        <Card>
          <CardHeader title="Subscriber growth" />
          <LineChartCard
            data={subsSeries}
            xKey="label"
            series={[{ key: "subscribers", name: "Subscribers", color: "#a78bff" }]}
            yFormat="compact"
          />
        </Card>
      </div>

      {/* Best performers */}
      <section>
        <SectionTitle title="Best-performing episodes" subtitle="Ranked by total views." />
        <Card className="p-0">
          {ranked.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No analytics yet" hint="Performance data appears once episodes are published and tracked." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-medium">Episode</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 text-right font-medium">Views</th>
                    <th className="px-3 py-3 text-right font-medium">Watch (h)</th>
                    <th className="px-3 py-3 text-right font-medium">CTR</th>
                    <th className="px-5 py-3 text-right font-medium">Retention</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map(({ ep, views, watchMin, ctr, retention }) => (
                    <tr key={ep.id} className="table-row hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <Link href={`/episodes/${ep.id}`} className="text-slate-200 hover:text-brand-soft">
                          #{ep.number} {ep.title || "Untitled"}
                        </Link>
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={ep.status} /></td>
                      <td className="px-3 py-3 text-right text-slate-300">{formatNumber(views, { compact: true })}</td>
                      <td className="px-3 py-3 text-right text-slate-400">{formatNumber(Math.round(watchMin / 60), { compact: true })}</td>
                      <td className="px-3 py-3 text-right text-slate-400">{formatPct(ctr, { fraction: true })}</td>
                      <td className="px-5 py-3 text-right text-slate-400">{formatPct(retention, { fraction: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* Recommendations */}
      <section>
        <SectionTitle title="AI recommendations" subtitle="Optimization ideas for titles, thumbnails, pacing, length and schedule." />
        {recommendations.length === 0 ? (
          <Card><EmptyState title="No recommendations" hint="The optimizer will surface ideas here." /></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {recommendations.map((r) => (
              <Card key={r.id} hover className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge tone="brand">{r.area}</Badge>
                  <StatusBadge status={r.impact} kind="impact" />
                </div>
                <p className="text-sm font-medium text-slate-100">{r.title}</p>
                <p className="mt-1 text-xs text-slate-500">{r.detail}</p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type Snapshot = {
  capturedAt: Date;
  views: number;
  watchTimeMin: number;
  ctr: number;
  avgViewPct: number;
};

function aggregateByDay(snapshots: Snapshot[]) {
  const map = new Map<string, { views: number; watchTimeMin: number; ctrSum: number; retSum: number; n: number }>();
  for (const s of snapshots) {
    const key = formatDate(s.capturedAt);
    const cur = map.get(key) ?? { views: 0, watchTimeMin: 0, ctrSum: 0, retSum: 0, n: 0 };
    cur.views += s.views;
    cur.watchTimeMin += s.watchTimeMin;
    cur.ctrSum += s.ctr;
    cur.retSum += s.avgViewPct;
    cur.n += 1;
    map.set(key, cur);
  }
  return [...map.entries()].map(([label, v]) => ({
    label,
    views: v.views,
    watchTimeMin: v.watchTimeMin,
    ctrPct: round1((v.ctrSum / v.n) * 100),
    retentionPct: round1((v.retSum / v.n) * 100),
  }));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
