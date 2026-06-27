import { prisma } from "./db";

type Level = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogOpts {
  scope?: string;
  episodeId?: string;
  jobId?: string;
  meta?: Record<string, unknown>;
}

// Dual-sink logger: writes to stdout (for container logs) and to the LogEntry
// table (for the admin dashboard's Logs view). DB writes are best-effort.
async function write(level: Level, message: string, opts: LogOpts = {}) {
  const line = `[${level}]${opts.scope ? ` (${opts.scope})` : ""} ${message}`;
  // eslint-disable-next-line no-console
  console[level === "ERROR" ? "error" : level === "WARN" ? "warn" : "log"](line);
  try {
    await prisma.logEntry.create({
      data: {
        level,
        scope: opts.scope ?? "",
        episodeId: opts.episodeId,
        jobId: opts.jobId,
        message,
        meta: (opts.meta ?? {}) as object,
      },
    });
  } catch {
    // Never let logging crash the pipeline.
  }
}

export const log = {
  debug: (m: string, o?: LogOpts) => write("DEBUG", m, o),
  info: (m: string, o?: LogOpts) => write("INFO", m, o),
  warn: (m: string, o?: LogOpts) => write("WARN", m, o),
  error: (m: string, o?: LogOpts) => write("ERROR", m, o),
};
