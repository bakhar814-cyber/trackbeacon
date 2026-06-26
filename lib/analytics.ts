"use client";
/**
 * Tiny PostHog wrapper. Loads only if NEXT_PUBLIC_POSTHOG_KEY is set, so the
 * app works with zero analytics config. Swap for posthog-js if you want the
 * full SDK; this keeps the starter dependency-free.
 */
export function track(event: string, props?: Record<string, unknown>) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  if (!key || typeof window === "undefined") return;
  try {
    navigator.sendBeacon(
      `${host}/capture/`,
      JSON.stringify({
        api_key: key,
        event,
        distinct_id: getId(),
        properties: { ...props, $current_url: location.href },
        timestamp: new Date().toISOString(),
      })
    );
  } catch {
    /* analytics must never break the app */
  }
}

function getId() {
  let id = localStorage.getItem("tb_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("tb_id", id);
  }
  return id;
}
