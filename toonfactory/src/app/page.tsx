import Link from "next/link";
import { EpisodeStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Stat } from "@/components/ui/Stat";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { PageHeader, SectionTitle } from "@/components/ui/SectionTitle";
import { PipelineStrip, completedStageCount } from "@/components/PipelineStrip";
import {
  formatNumber,
  formatMicroUsd,
  formatUsd,
  formatDuration,
  timeAgo,
} from "@/lib/format";
import { PIPELINE_STAGES } from "@/lib/pipeline/stages";

export const dynamic = "force-dynamic";

const IN_FLIGHT = [
  "WRITING",
  "STORYBOARD",
  "ASSETS",
  "ANIMATION",
  "AUDIO",
  "EDITING",
  "REVIEW",
] as EpisodeStatus[];

export default async function OverviewPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    completedCount,
    scheduledCount,
    latestChannel,
    revenueAgg,
    todayProduced,
    costAgg,
    inFlight,
    recentEpisodes,
    recommendations,
  ] = await Promise.all([
    prisma.episode.count({ where: { status: "PUBLISHED" } }),
    prisma.episode.count({ where: { status: "SCHEDULED" } }),
    prisma.channelStat.findFirst({ orderBy: { capturedAt: "desc" } }),
    prisma.analyticsSnapshot.aggregate({
      _sum: { revenueUsd: true },
      where: { capturedAt: { gte: monthAgo() } },
    }),
    prisma.episode.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.episode.aggregate({ _sum: { costMicroUsd: true } }),
    prisma.episode.findFirst({
      where: { status: { in: IN_FLIGHT } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.episode.findMany({ orderBy: { updatedAt: "desc" }, take: 6 }),
    prisma.recommendation.findMany({
      where: { applied: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const estMonthlyRevenue = revenueAgg._sum.revenueUsd ?? 0;
  const totalCostMicro = costAgg._sum.costMicroUsd ?? 0;

  return (
    <div className="space-y-8 pb-20 lg:pb-8">
      <PageHeader
        title="Mission Control"
        subtitle="Live overview of your autonomous cartoon studio."
        action={
          <Link
            href="/production"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-sm font-medium text-white shadow-glow transition hover:bg-brand-soft"
          >
            Open production
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Videos completed" value={formatNumber(completedCount)} accent="good" hint="Published to YouTube" />
        <Stat label="Scheduled" value={formatNumber(scheduledCount)} accent="accent" hint="Queued for release" />
        <Stat
          label="Subscribers"
          value={formatNumber(latestChannel?.subscribers ?? 0, { compact: true })}
          accent="brand"
          hint={latestChannel ? `as of ${timeAgo(latestChannel.capturedAt)}` : "no data yet"}
        />
        <Stat
          label="Est. monthly revenue"
          value={formatUsd(estMonthlyRevenue)}
          accent="good"
          hint="Trailing 30 days"
        />
        <Stat label="Produced today" value={formatNumber(todayProduced)} accent="accent" hint="New episodes" />
        <Stat label="Total cost" value={formatMicroUsd(totalCostMicro, { compact: true })} accent="warn" hint="All-time API spend" />
      </div>

      {/* In-flight pipeline strip */}
      <section>
        <SectionTitle title="Latest in production" subtitle="Current pipeline progress for the active episode." />
        {inFlight ? (
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-sm font-bold text-brand-soft">
                  #{inFlight.number}
                </span>
                <div>
                  <Link href={`/episodes/${inFlight.id}`} className="font-medium text-white hover:text-brand-soft">
                    {inFlight.title || `Episode ${inFlight.number}`}
                  </Link>
                  <div className="text-xs text-slate-500">Updated {timeAgo(inFlight.updatedAt)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  {completedStageCount(inFlight.status)}/{PIPELINE_STAGES.length} stages
                </span>
                <StatusBadge status={inFlight.status} />
              </div>
            </div>
            <PipelineStrip status={inFlight.status} />
          </Card>
        ) : (
          <Card>
            <EmptyState
              title="Nothing in production"
              hint="Start the pipeline from the Production page to see live stage progress here."
            />
          </Card>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Recent episodes */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent episodes"
            action={
              <Link href="/episodes" className="text-xs text-brand-soft hover:underline">
                View all
              </Link>
            }
          />
          {recentEpisodes.length === 0 ? (
            <EmptyState title="No episodes yet" hint="Produce your first episode to get started." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 font-medium">#</th>
                    <th className="pb-2 font-medium">Title</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Duration</th>
                    <th className="pb-2 text-right font-medium">Cost</th>
                    <th className="pb-2 text-right font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEpisodes.map((ep) => (
                    <tr key={ep.id} className="table-row">
                      <td className="py-2.5 text-slate-400">{ep.number}</td>
                      <td className="py-2.5">
                        <Link href={`/episodes/${ep.id}`} className="text-slate-200 hover:text-brand-soft">
                          {ep.title || `Episode ${ep.number}`}
                        </Link>
                      </td>
                      <td className="py-2.5">
                        <StatusBadge status={ep.status} />
                      </td>
                      <td className="py-2.5 text-right text-slate-400">{formatDuration(ep.targetSeconds)}</td>
                      <td className="py-2.5 text-right text-slate-400">{formatMicroUsd(ep.costMicroUsd)}</td>
                      <td className="py-2.5 text-right text-slate-500">{timeAgo(ep.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader
            title="AI recommendations"
            action={
              <Link href="/analytics" className="text-xs text-brand-soft hover:underline">
                More
              </Link>
            }
          />
          {recommendations.length === 0 ? (
            <EmptyState title="No recommendations" hint="The optimizer will surface ideas here." />
          ) : (
            <ul className="space-y-3">
              {recommendations.map((r) => (
                <li key={r.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Badge tone="brand">{r.area}</Badge>
                    <StatusBadge status={r.impact} kind="impact" />
                  </div>
                  <p className="text-sm font-medium text-slate-200">{r.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{r.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function monthAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}
