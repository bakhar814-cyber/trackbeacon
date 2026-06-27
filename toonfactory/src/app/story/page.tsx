import { prisma } from "@/lib/db";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader, SectionTitle } from "@/components/ui/SectionTitle";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const ROLE_TONE: Record<string, "brand" | "bad" | "neutral"> = {
  protagonist: "brand",
  antagonist: "bad",
  supporting: "neutral",
};

export default async function StoryPage() {
  const series = await prisma.series.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      characters: { orderBy: { createdAt: "asc" } },
      locations: { orderBy: { createdAt: "asc" } },
      relationships: {
        include: {
          a: { select: { name: true } },
          b: { select: { name: true } },
        },
      },
    },
  });

  if (!series) {
    return (
      <div className="space-y-6 pb-20 lg:pb-8">
        <PageHeader title="Story Universe" subtitle="Series bible, characters, locations and canon." />
        <Card>
          <EmptyState title="No series yet" hint="Seed or create a series to populate the story universe." />
        </Card>
      </div>
    );
  }

  const canon = await prisma.canonFact.findMany({
    where: { seriesId: series.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const worldRules = toRuleList(series.worldRules);
  const artStyle = toKeyValues(series.artStyle);

  return (
    <div className="space-y-8 pb-20 lg:pb-8">
      <PageHeader title="Story Universe" subtitle={series.logline} />

      {/* Series info + world rules */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={series.title} subtitle={`Target age ${series.targetAge}`} />
          <p className="mb-4 text-sm text-slate-300">{series.logline}</p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">World rules</h4>
              {worldRules.length === 0 ? (
                <p className="text-sm text-slate-500">No world rules defined.</p>
              ) : (
                <ul className="space-y-1.5">
                  {worldRules.map((rule, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-300">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Art style</h4>
              {artStyle.length === 0 ? (
                <p className="text-sm text-slate-500">No art style bible defined.</p>
              ) : (
                <dl className="space-y-1.5 text-sm">
                  {artStyle.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="capitalize text-slate-500">{k}</dt>
                      <dd className="text-right text-slate-300">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="At a glance" />
          <dl className="space-y-3">
            <Counter label="Characters" value={series.characters.length} />
            <Counter label="Locations" value={series.locations.length} />
            <Counter label="Relationships" value={series.relationships.length} />
            <Counter label="Canon facts" value={canon.length} />
          </dl>
        </Card>
      </div>

      {/* Characters */}
      <section>
        <SectionTitle title="Characters" subtitle="Frozen design specs keep every render consistent." />
        {series.characters.length === 0 ? (
          <Card><EmptyState title="No characters yet" /></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {series.characters.map((c) => {
              const palette = extractPalette(c.appearance);
              const appearance = toKeyValues(c.appearance).filter(([k]) => k.toLowerCase() !== "palette");
              return (
                <Card key={c.id} hover>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-white">{c.name}</h3>
                      {c.age && <p className="text-xs text-slate-500">Age {c.age}</p>}
                    </div>
                    <Badge tone={ROLE_TONE[c.role] ?? "neutral"}>{c.role}</Badge>
                  </div>

                  {palette.length > 0 && (
                    <div className="mb-3 flex items-center gap-1.5">
                      {palette.map((hex, i) => (
                        <span
                          key={i}
                          title={hex}
                          className="h-6 w-6 rounded-md ring-1 ring-white/15"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  )}

                  {appearance.length > 0 && (
                    <dl className="mb-3 space-y-1 text-xs">
                      {appearance.slice(0, 4).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt className="capitalize text-slate-500">{k}</dt>
                          <dd className="truncate text-right text-slate-400">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {c.designToken && (
                    <p className="rounded-lg bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-slate-400 ring-1 ring-inset ring-white/5">
                      {c.designToken}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Locations + Relationships */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title="Locations" />
          {series.locations.length === 0 ? (
            <Card><EmptyState title="No locations yet" /></Card>
          ) : (
            <div className="space-y-3">
              {series.locations.map((loc) => (
                <Card key={loc.id} hover className="p-4">
                  <h3 className="font-medium text-white">{loc.name}</h3>
                  <p className="mt-1 text-sm text-slate-400">{loc.description}</p>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle title="Relationships" />
          {series.relationships.length === 0 ? (
            <Card><EmptyState title="No relationships mapped" /></Card>
          ) : (
            <Card className="p-4">
              <ul className="space-y-3">
                {series.relationships.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-slate-200">{r.a?.name ?? "?"}</span>
                    <span className="text-slate-600">—</span>
                    <Badge tone="accent">{r.kind}</Badge>
                    <span className="text-slate-600">—</span>
                    <span className="font-medium text-slate-200">{r.b?.name ?? "?"}</span>
                    {r.status && r.status !== "neutral" && (
                      <span className="ml-auto text-xs text-slate-500">{r.status}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>

      {/* Canon timeline */}
      <section>
        <SectionTitle title="Canon timeline" subtitle="Chronological record of established facts to prevent plot holes." />
        {canon.length === 0 ? (
          <Card><EmptyState title="No canon facts recorded" hint="Story events get logged here as episodes are produced." /></Card>
        ) : (
          <Card>
            <ol className="relative space-y-5 border-l border-white/10 pl-5">
              {canon.map((fact) => (
                <li key={fact.id} className="relative">
                  <span className="absolute -left-[1.45rem] top-1 h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-ink" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{fact.category}</Badge>
                    <span className="text-xs text-slate-500">{formatDate(fact.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-200">{fact.summary}</p>
                  {fact.detail && <p className="mt-0.5 text-xs text-slate-500">{fact.detail}</p>}
                </li>
              ))}
            </ol>
          </Card>
        )}
      </section>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="text-lg font-semibold text-white">{value}</dd>
    </div>
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// worldRules may be an array of strings, an object of rules, or { rules: [...] }.
function toRuleList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (isObject(v)) {
    if (Array.isArray(v.rules)) return v.rules.map(String).filter(Boolean);
    if (Array.isArray(v.dos) || Array.isArray(v.donts)) {
      return [
        ...(Array.isArray(v.dos) ? v.dos.map((x) => `Do: ${String(x)}`) : []),
        ...(Array.isArray(v.donts) ? v.donts.map((x) => `Don't: ${String(x)}`) : []),
      ];
    }
    return Object.values(v).map(String).filter(Boolean);
  }
  return [];
}

function toKeyValues(v: unknown): [string, string][] {
  if (!isObject(v)) return [];
  return Object.entries(v)
    .filter(([, val]) => val !== null && val !== undefined && typeof val !== "object")
    .map(([k, val]) => [k, String(val)] as [string, string]);
}

// Pull hex codes from appearance.palette (array or object) or scan all string values.
function extractPalette(v: unknown): string[] {
  const hexRe = /^#?[0-9a-fA-F]{3,8}$/;
  const norm = (s: string) => (s.startsWith("#") ? s : `#${s}`);
  if (!isObject(v)) return [];
  const candidates: string[] = [];
  const palette = v.palette;
  if (Array.isArray(palette)) {
    for (const p of palette) if (typeof p === "string" && hexRe.test(p)) candidates.push(norm(p));
  } else if (isObject(palette)) {
    for (const p of Object.values(palette)) if (typeof p === "string" && hexRe.test(p)) candidates.push(norm(p));
  }
  if (candidates.length === 0) {
    for (const val of Object.values(v)) {
      if (typeof val === "string" && val.startsWith("#") && hexRe.test(val)) candidates.push(norm(val));
    }
  }
  return candidates.slice(0, 6);
}
