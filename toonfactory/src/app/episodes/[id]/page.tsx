import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { PageHeader, SectionTitle } from "@/components/ui/SectionTitle";
import { PipelineStrip } from "@/components/PipelineStrip";
import {
  formatDuration,
  formatMicroUsd,
  formatDate,
  timeAgo,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type SeoShape = {
  title?: string;
  description?: string;
  tags?: string[];
  chapters?: { time?: string; label?: string }[];
  keywords?: string[];
  hashtags?: string[];
};

export default async function EpisodeDetailPage({ params }: { params: { id: string } }) {
  const episode = await prisma.episode.findUnique({
    where: { id: params.id },
    include: {
      scenes: { orderBy: { index: "asc" } },
      thumbnails: { orderBy: { score: "desc" } },
      jobs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!episode) notFound();

  const costEvents = await prisma.costEvent.findMany({
    where: { episodeId: episode.id },
    orderBy: { createdAt: "desc" },
  });

  const outline = asStringArray(episode.outline);
  const seo = (isObject(episode.seo) ? episode.seo : {}) as SeoShape;

  // Cost breakdown by category.
  const costByCategory = new Map<string, number>();
  for (const c of costEvents) {
    costByCategory.set(c.category, (costByCategory.get(c.category) ?? 0) + c.costMicroUsd);
  }

  return (
    <div className="space-y-8 pb-20 lg:pb-8">
      <div>
        <Link href="/episodes" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
          <span aria-hidden>←</span> All episodes
        </Link>
        <PageHeader
          title={
            <span className="flex items-center gap-3">
              <span className="text-slate-500">#{episode.number}</span>
              <span>{episode.title || `Episode ${episode.number}`}</span>
            </span>
          }
          subtitle={
            <span className="flex flex-wrap items-center gap-3">
              <StatusBadge status={episode.status} />
              <span className="text-slate-500">·</span>
              <span>{formatDuration(episode.targetSeconds)}</span>
              <span className="text-slate-500">·</span>
              <span>{formatMicroUsd(episode.costMicroUsd)}</span>
              <span className="text-slate-500">·</span>
              <span>updated {timeAgo(episode.updatedAt)}</span>
            </span>
          }
          action={
            episode.youtubeId ? (
              <a
                href={`https://youtu.be/${episode.youtubeId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-bad/90 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-bad"
              >
                Watch on YouTube
              </a>
            ) : undefined
          }
        />
      </div>

      <Card>
        <CardHeader title="Pipeline progress" />
        <PipelineStrip status={episode.status} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Story */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Story" />
            <dl className="space-y-4">
              <Field label="Hook" value={episode.hook} placeholder="No hook written yet." />
              <div>
                <dt className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Outline</dt>
                {outline.length === 0 ? (
                  <p className="text-sm text-slate-500">No outline yet.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {outline.map((beat, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-slate-600">{i + 1}.</span>
                        <span>{beat}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <Field label="Cliffhanger" value={episode.cliffhanger} placeholder="No cliffhanger yet." />
              <Field label="Next episode setup" value={episode.nextSetup} placeholder="—" />
            </dl>
          </Card>

          {/* Scenes */}
          <Card>
            <CardHeader title="Scenes" subtitle={`${episode.scenes.length} scene${episode.scenes.length === 1 ? "" : "s"}`} />
            {episode.scenes.length === 0 ? (
              <EmptyState title="No scenes yet" hint="Scenes are generated during the storyboard stage." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Heading</th>
                      <th className="pb-2 font-medium">Mood</th>
                      <th className="pb-2 text-right font-medium">Dur</th>
                      <th className="pb-2 text-center font-medium">Img</th>
                      <th className="pb-2 text-center font-medium">Clip</th>
                      <th className="pb-2 text-center font-medium">Voice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {episode.scenes.map((s) => (
                      <tr key={s.id} className="table-row">
                        <td className="py-2.5 text-slate-500">{s.index + 1}</td>
                        <td className="py-2.5 text-slate-200">{s.heading || <span className="text-slate-600">Untitled scene</span>}</td>
                        <td className="py-2.5">
                          <span className="text-xs text-slate-400">{s.mood}</span>
                        </td>
                        <td className="py-2.5 text-right text-slate-400">{formatDuration(s.durationSec)}</td>
                        <td className="py-2.5 text-center"><Check on={!!s.imageUrl} /></td>
                        <td className="py-2.5 text-center"><Check on={!!s.clipUrl} /></td>
                        <td className="py-2.5 text-center"><Check on={hasVoice(s.voiceUrls)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Video */}
          <Card>
            <CardHeader title="Final video" />
            {episode.videoUrl ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={episode.videoUrl} controls className="w-full rounded-xl ring-1 ring-white/10" />
                <div className="flex flex-wrap gap-2 text-xs">
                  <a href={episode.videoUrl} target="_blank" rel="noreferrer" className="text-brand-soft hover:underline">
                    Open video file
                  </a>
                  {episode.youtubeId && (
                    <a href={`https://youtu.be/${episode.youtubeId}`} target="_blank" rel="noreferrer" className="text-brand-soft hover:underline">
                      youtu.be/{episode.youtubeId}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState title="No video yet" hint="The rendered MP4 appears here after the edit stage." />
            )}
          </Card>
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          {/* Thumbnails */}
          <Card>
            <CardHeader title="Thumbnails" subtitle={`${episode.thumbnails.length} generated`} />
            {episode.thumbnails.length === 0 ? (
              <EmptyState title="No thumbnails" hint="Generated and scored during the thumbnail stage." />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {episode.thumbnails.map((t) => (
                  <div
                    key={t.id}
                    className={`relative overflow-hidden rounded-xl ring-1 ${
                      t.chosen ? "ring-2 ring-brand shadow-glow" : "ring-white/10"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.url} alt="thumbnail" className="aspect-video w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
                      <span className="text-[11px] font-medium text-white">{Math.round(t.score)}</span>
                      {t.chosen && <Badge tone="brand">chosen</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader title="SEO" />
            {isEmptySeo(seo) ? (
              <EmptyState title="No SEO data" hint="Generated during the SEO stage." />
            ) : (
              <div className="space-y-3 text-sm">
                {seo.title && <Field label="Title" value={seo.title} />}
                {seo.description && <Field label="Description" value={seo.description} />}
                {seo.tags && seo.tags.length > 0 && (
                  <div>
                    <dt className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Tags</dt>
                    <div className="flex flex-wrap gap-1.5">
                      {seo.tags.map((tag, i) => (
                        <Badge key={i} tone="neutral">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {seo.chapters && seo.chapters.length > 0 && (
                  <div>
                    <dt className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Chapters</dt>
                    <ul className="space-y-1">
                      {seo.chapters.map((c, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-400">
                          <span className="font-mono text-slate-500">{c.time ?? "0:00"}</span>
                          <span>{c.label ?? ""}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Cost breakdown */}
          <Card>
            <CardHeader title="Cost breakdown" subtitle={`Total ${formatMicroUsd(episode.costMicroUsd)}`} />
            {costByCategory.size === 0 ? (
              <EmptyState title="No cost recorded" />
            ) : (
              <ul className="space-y-2">
                {[...costByCategory.entries()].sort((a, b) => b[1] - a[1]).map(([cat, micro]) => (
                  <li key={cat} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-slate-400">{cat}</span>
                    <span className="font-medium text-slate-200">{formatMicroUsd(micro)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Schedule info */}
          <Card>
            <CardHeader title="Release" />
            <dl className="space-y-2 text-sm">
              <Row label="Scheduled" value={episode.scheduledFor ? formatDate(episode.scheduledFor) : "—"} />
              <Row label="Published" value={episode.publishedAt ? formatDate(episode.publishedAt) : "—"} />
              <Row label="Created" value={formatDate(episode.createdAt)} />
            </dl>
          </Card>
        </div>
      </div>

      {/* Job history */}
      <Card>
        <CardHeader title="Job history" subtitle={`${episode.jobs.length} job${episode.jobs.length === 1 ? "" : "s"}`} />
        {episode.jobs.length === 0 ? (
          <EmptyState title="No jobs recorded" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 font-medium">Stage</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Attempts</th>
                  <th className="pb-2 text-right font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {episode.jobs.map((job) => (
                  <tr key={job.id} className="table-row align-top">
                    <td className="py-2.5">
                      <span className="text-slate-200">{job.stage}</span>
                      {job.error && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-bad" title={job.error}>{job.error}</p>
                      )}
                    </td>
                    <td className="py-2.5"><StatusBadge status={job.status} kind="job" /></td>
                    <td className="py-2.5 text-right text-slate-400">{job.attempts}/{job.maxAttempts}</td>
                    <td className="py-2.5 text-right text-slate-500">{timeAgo(job.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value, placeholder }: { label: string; value?: string | null; placeholder?: string }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-300">{value && value.length > 0 ? value : <span className="text-slate-600">{placeholder ?? "—"}</span>}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-300">{value}</dd>
    </div>
  );
}

function Check({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-good/15 text-good">
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  ) : (
    <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/15" />
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => (typeof x === "string" ? x : isObject(x) && typeof x.text === "string" ? x.text : String(x))).filter(Boolean);
  }
  return [];
}

function hasVoice(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

function isEmptySeo(seo: SeoShape): boolean {
  return (
    !seo.title &&
    !seo.description &&
    (!seo.tags || seo.tags.length === 0) &&
    (!seo.chapters || seo.chapters.length === 0)
  );
}
