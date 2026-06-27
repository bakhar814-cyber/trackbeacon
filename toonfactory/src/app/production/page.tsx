import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { PageHeader, SectionTitle } from "@/components/ui/SectionTitle";
import { StageChecklist, completedStageCount } from "@/components/PipelineStrip";
import { ProductionActions } from "@/components/ProductionActions";
import { STAGE_LABELS, PIPELINE_STAGES } from "@/lib/pipeline/stages";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

// Lanes for the board, in production order. FAILED shown last when present.
const LANES: { key: string; label: string }[] = [
  { key: "PLANNED", label: "Planned" },
  { key: "WRITING", label: "Writing" },
  { key: "STORYBOARD", label: "Storyboard" },
  { key: "ASSETS", label: "Assets" },
  { key: "ANIMATION", label: "Animation" },
  { key: "AUDIO", label: "Audio" },
  { key: "EDITING", label: "Editing" },
  { key: "REVIEW", label: "Review" },
  { key: "READY", label: "Ready" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "PUBLISHED", label: "Published" },
  { key: "FAILED", label: "Failed" },
];

export default async function ProductionPage() {
  const [episodes, jobs] = await Promise.all([
    prisma.episode.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.job.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 25,
      include: { episode: { select: { number: true, title: true, id: true } } },
    }),
  ]);

  const byStatus = new Map<string, typeof episodes>();
  for (const ep of episodes) {
    const list = byStatus.get(ep.status) ?? [];
    list.push(ep);
    byStatus.set(ep.status, list);
  }

  // Only show lanes that have episodes, but always keep at least the active ones.
  const activeLanes = LANES.filter((l) => (byStatus.get(l.key)?.length ?? 0) > 0);

  return (
    <div className="space-y-8 pb-20 lg:pb-8">
      <PageHeader
        title="Production"
        subtitle="Episode pipeline status board and live job queue."
        action={<ProductionActions />}
      />

      {episodes.length === 0 ? (
        <Card>
          <EmptyState
            title="No episodes in the pipeline"
            hint='Click "Produce next episode" to plan and run the first one.'
          />
        </Card>
      ) : (
        <section>
          <SectionTitle
            title="Status board"
            subtitle={`${episodes.length} episode${episodes.length === 1 ? "" : "s"} across ${activeLanes.length} stage${activeLanes.length === 1 ? "" : "s"}.`}
          />
          <div className="flex gap-4 overflow-x-auto pb-2">
            {activeLanes.map((lane) => {
              const items = byStatus.get(lane.key) ?? [];
              return (
                <div key={lane.key} className="w-72 shrink-0">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={lane.key} />
                    </div>
                    <span className="text-xs text-slate-500">{items.length}</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((ep) => (
                      <Card key={ep.id} hover className="p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <Link
                            href={`/episodes/${ep.id}`}
                            className="text-sm font-medium text-white hover:text-brand-soft"
                          >
                            #{ep.number} {ep.title || "Untitled"}
                          </Link>
                        </div>
                        <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            {completedStageCount(ep.status)}/{PIPELINE_STAGES.length} stages
                          </span>
                          <span>{timeAgo(ep.updatedAt)}</span>
                        </div>
                        <StageChecklist status={ep.status} />
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Job queue */}
      <section>
        <Card>
          <CardHeader
            title="Job queue"
            subtitle="Most recent worker jobs across all episodes."
          />
          {jobs.length === 0 ? (
            <EmptyState title="Queue is empty" hint="Run a worker tick to process queued jobs." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 font-medium">Stage</th>
                    <th className="pb-2 font-medium">Episode</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Attempts</th>
                    <th className="pb-2 text-right font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const label = STAGE_LABELS[job.stage as keyof typeof STAGE_LABELS] ?? job.stage;
                    return (
                      <tr key={job.id} className="table-row align-top">
                        <td className="py-2.5">
                          <span className="font-medium text-slate-200">{label}</span>
                          {job.error && (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-bad" title={job.error}>
                              {job.error}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-400">
                          {job.episode ? (
                            <Link href={`/episodes/${job.episode.id}`} className="hover:text-brand-soft">
                              #{job.episode.number}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5">
                          <StatusBadge status={job.status} kind="job" />
                        </td>
                        <td className="py-2.5 text-right text-slate-400">
                          {job.attempts}/{job.maxAttempts}
                        </td>
                        <td className="py-2.5 text-right text-slate-500">{timeAgo(job.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
