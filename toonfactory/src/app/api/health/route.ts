import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { json, errorJson } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({
      ok: true,
      mode: config.mode,
      providers: config.providers,
      time: new Date().toISOString(),
    });
  } catch (err) {
    return errorJson(`db unreachable: ${String(err)}`, 503);
  }
}
