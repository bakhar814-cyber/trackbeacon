import { NextResponse } from "next/server";
import { config } from "./config";

export const json = <T>(data: T, status = 200) =>
  NextResponse.json(data as object, { status });

export const errorJson = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

// Guards internal/cron endpoints with the shared secret (x-cron-secret header
// or ?secret= query). Returns null when authorized, or a 401 response.
export function requireCronSecret(req: Request): NextResponse | null {
  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  if ([header, bearer, q].includes(config.cronSecret)) return null;
  return errorJson("unauthorized", 401);
}
