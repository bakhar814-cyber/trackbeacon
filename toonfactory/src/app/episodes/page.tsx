import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, EmptyState } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/SectionTitle";
import { formatDuration, formatMicroUsd, formatDate, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EpisodesPage() {
  const episodes = await prisma.episode.findMany({
    orderBy: { number: "desc" },
  });

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      <PageHeader
        title="Episodes"
        subtitle={`${episodes.length} episode${episodes.length === 1 ? "" : "s"} in the series.`}
      />

      {episodes.length === 0 ? (
        <Card>
          <EmptyState title="No episodes yet" hint="Episodes will appear here once the pipeline produces them." />
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Episode</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Duration</th>
                  <th className="px-3 py-3 text-right font-medium">Cost</th>
                  <th className="px-3 py-3 font-medium">Scheduled</th>
                  <th className="px-5 py-3 font-medium">Published</th>
                </tr>
              </thead>
              <tbody>
                {episodes.map((ep) => (
                  <tr key={ep.id} className="table-row transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Thumb url={ep.thumbnailUrl} number={ep.number} />
                        <div className="min-w-0">
                          <Link
                            href={`/episodes/${ep.id}`}
                            className="block truncate font-medium text-slate-100 hover:text-brand-soft"
                          >
                            {ep.title || `Episode ${ep.number}`}
                          </Link>
                          <span className="text-xs text-slate-500">Ep #{ep.number}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={ep.status} />
                    </td>
                    <td className="px-3 py-3 text-right text-slate-400">{formatDuration(ep.targetSeconds)}</td>
                    <td className="px-3 py-3 text-right text-slate-400">{formatMicroUsd(ep.costMicroUsd)}</td>
                    <td className="px-3 py-3 text-slate-400">
                      {ep.scheduledFor ? (
                        <span title={formatDate(ep.scheduledFor)}>{timeAgo(ep.scheduledFor)}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {ep.publishedAt ? formatDate(ep.publishedAt) : <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Thumb({ url, number }: { url: string | null; number: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={`Episode ${number} thumbnail`}
        className="h-10 w-16 shrink-0 rounded-md object-cover ring-1 ring-white/10"
      />
    );
  }
  return (
    <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-panel2 to-panel text-xs font-semibold text-slate-500 ring-1 ring-white/10">
      #{number}
    </div>
  );
}
