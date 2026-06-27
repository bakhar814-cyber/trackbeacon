import { prisma } from "@/lib/db";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader, SectionTitle } from "@/components/ui/SectionTitle";
import { config } from "@/lib/config";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await prisma.setting.findMany({ orderBy: { key: "asc" } });

  const providers = Object.entries(config.providers);

  return (
    <div className="space-y-8 pb-20 lg:pb-8">
      <PageHeader
        title="Settings"
        subtitle="Provider selection, schedule and stored configuration."
        action={
          <Badge tone={config.mode === "live" ? "good" : "warn"} dot>
            {config.mode === "live" ? "Live mode" : "Mock mode"}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Providers */}
        <Card>
          <CardHeader title="Providers" subtitle="Configured via environment variables." />
          <ul className="divide-y divide-white/5">
            {providers.map(([kind, value]) => (
              <li key={kind} className="flex items-center justify-between py-2.5 text-sm">
                <span className="capitalize text-slate-400">{kind}</span>
                <Badge tone={value === "mock" ? "neutral" : "brand"}>{value}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        {/* Schedule + series */}
        <Card>
          <CardHeader title="Series & schedule" />
          <dl className="space-y-2.5 text-sm">
            <Row label="Series title" value={config.series.title} />
            <Row label="Episodes per day" value={String(config.series.episodesPerDay)} />
            <Row label="Target length" value={`${Math.round(config.series.targetSeconds / 60)} min`} />
            <Row label="Environment" value={config.env} />
            <Row label="App base URL" value={config.appBaseUrl} />
          </dl>
        </Card>
      </div>

      {/* Storage + YouTube */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Storage" />
          <dl className="space-y-2.5 text-sm">
            <Row label="Driver" value={config.storage.driver} />
            {config.storage.driver === "s3" ? (
              <>
                <Row label="Bucket" value={config.storage.s3Bucket} />
                <Row label="Region" value={config.storage.s3Region} />
              </>
            ) : (
              <Row label="Local dir" value={config.storage.localDir} />
            )}
          </dl>
        </Card>
        <Card>
          <CardHeader title="YouTube" />
          <dl className="space-y-2.5 text-sm">
            <Row label="Channel ID" value={config.youtube.channelId || "not set"} />
            <Row
              label="OAuth"
              value={config.youtube.refreshToken ? <Badge tone="good">connected</Badge> : <Badge tone="warn">not connected</Badge>}
            />
          </dl>
        </Card>
      </div>

      <p className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-slate-500">
        Provider selection and credentials are controlled through environment variables and are read-only here.
        Editable runtime values are stored as settings below.
      </p>

      {/* Stored settings */}
      <section>
        <SectionTitle title="Stored settings" subtitle="Key/value configuration in the database." />
        <Card className="p-0">
          {settings.length === 0 ? (
            <div className="p-5"><EmptyState title="No stored settings" hint="Runtime settings will appear here once written." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-medium">Key</th>
                    <th className="px-3 py-3 font-medium">Value</th>
                    <th className="px-5 py-3 text-right font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.map((s) => (
                    <tr key={s.key} className="table-row align-top">
                      <td className="px-5 py-3 font-medium text-slate-200">{s.key}</td>
                      <td className="px-3 py-3">
                        <pre className="max-w-md overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-400">
                          {stringify(s.value)}
                        </pre>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">{formatDateTime(s.updatedAt)}</td>
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate text-right text-slate-300">{value}</dd>
    </div>
  );
}

function stringify(value: unknown): string {
  try {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
