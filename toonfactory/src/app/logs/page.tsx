import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/SectionTitle";
import { LogViewer, type LogRow } from "@/components/LogViewer";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const logs = await prisma.logEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const rows: LogRow[] = logs.map((l) => ({
    id: l.id,
    level: l.level,
    scope: l.scope,
    message: l.message,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      <PageHeader title="Logs" subtitle="Recent pipeline and system activity (latest 200 entries)." />
      <LogViewer logs={rows} />
    </div>
  );
}
