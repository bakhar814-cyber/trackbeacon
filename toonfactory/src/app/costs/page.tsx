import { prisma } from "@/lib/db";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader, SectionTitle } from "@/components/ui/SectionTitle";
import { Stat } from "@/components/ui/Stat";
import { BarChartCard } from "@/components/charts/BarChartCard";
import { formatMicroUsd, formatNumber, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const [events, totalAgg, episodeCount, recent] = await Promise.all([
    prisma.costEvent.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.costEvent.aggregate({ _sum: { costMicroUsd: true } }),
    prisma.episode.count(),
    prisma.costEvent.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);

  const totalMicro = totalAgg._sum.costMicroUsd ?? 0;
  const perEpisodeMicro = episodeCount > 0 ? Math.round(totalMicro / episodeCount) : 0;

  const byCategory = groupSum(events, (e) => e.category);
  const byProvider = groupSum(events, (e) => e.provider || "unknown");

  const categoryChart = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, micro]) => ({ label, value: Math.round(micro / 10000) / 100 })); // -> dollars

  return (
    <div className="space-y-8 pb-20 lg:pb-8">
      <PageHeader title="Costs" subtitle="API usage and spend across all providers." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total spend" value={formatMicroUsd(totalMicro)} accent="warn" hint="All-time" />
        <Stat label="Cost / episode" value={formatMicroUsd(perEpisodeMicro)} accent="brand" hint={`${formatNumber(episodeCount)} episodes`} />
        <Stat label="Cost events" value={formatNumber(events.length)} accent="accent" />
        <Stat label="Providers" value={formatNumber(byProvider.size)} accent="good" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Cost by category" subtitle="USD" />
          <BarChartCard
            data={categoryChart}
            xKey="label"
            yKey="value"
            multicolor
            yFormat="currency"
          />
        </Card>

        <Card>
          <CardHeader title="By provider" />
          {byProvider.size === 0 ? (
            <EmptyState title="No spend yet" />
          ) : (
            <ul className="space-y-2">
              {[...byProvider.entries()].sort((a, b) => b[1] - a[1]).map(([provider, micro]) => {
                const pct = totalMicro > 0 ? (micro / totalMicro) * 100 : 0;
                return (
                  <li key={provider}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-slate-300">{provider}</span>
                      <span className="text-slate-400">{formatMicroUsd(micro)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-brand to-brand-soft" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <section>
        <SectionTitle title="Recent cost events" />
        <Card className="p-0">
          {recent.length === 0 ? (
            <div className="p-5"><EmptyState title="No cost events recorded" hint="Provider calls log their cost here." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-medium">Provider</th>
                    <th className="px-3 py-3 font-medium">Category</th>
                    <th className="px-3 py-3 text-right font-medium">Units</th>
                    <th className="px-3 py-3 text-right font-medium">Cost</th>
                    <th className="px-5 py-3 text-right font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e) => (
                    <tr key={e.id} className="table-row hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-slate-200">{e.provider || "—"}</td>
                      <td className="px-3 py-3"><Badge tone="neutral">{e.category}</Badge></td>
                      <td className="px-3 py-3 text-right text-slate-400">
                        {e.units > 0 ? `${formatNumber(e.units)}${e.unit ? ` ${e.unit}` : ""}` : "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-300">{formatMicroUsd(e.costMicroUsd)}</td>
                      <td className="px-5 py-3 text-right text-slate-500">{timeAgo(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function groupSum<T>(items: T[], keyOf: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    const cost = (item as unknown as { costMicroUsd: number }).costMicroUsd ?? 0;
    map.set(key, (map.get(key) ?? 0) + cost);
  }
  return map;
}
