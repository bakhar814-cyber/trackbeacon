// Shared HTTP helper for live providers: per-request timeout + bounded retries
// on 429/5xx and network errors, honoring Retry-After with exponential backoff.
// Returns the final Response (the caller checks res.ok and reads the error body);
// throws only on network/abort failures after exhausting attempts.

export interface FetchRetryOptions {
  attempts?: number;
  timeoutMs?: number;
  retryOn?: (status: number) => boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchRetry(
  url: string,
  init: RequestInit,
  opts: FetchRetryOptions = {},
): Promise<Response> {
  const attempts = opts.attempts ?? 4;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const retryOn = opts.retryOn ?? ((s) => s === 429 || s >= 500);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.ok || !retryOn(res.status) || attempt === attempts) return res;
      // Retryable error status: back off then try again.
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(16_000, 1_000 * 2 ** (attempt - 1));
      await sleep(backoff);
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof Error && /aborted|network|fetch failed|ECONN|ETIMEDOUT/i.test(err.message);
      if (attempt === attempts || !retryable) throw err;
      await sleep(Math.min(16_000, 1_000 * 2 ** (attempt - 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Request to ${url} failed`);
}
