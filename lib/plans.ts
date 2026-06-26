/**
 * Plan limits. Enforced SERVER-SIDE (see app/api/track/route.ts and the cron).
 * Never trust the client for gating.
 */
export type Plan = "free" | "pro";

export const PLANS = {
  free: {
    label: "Free",
    maxTrackers: 3,
    /** How often this user's items are eligible to be re-checked, in minutes. */
    checkIntervalMinutes: 60 * 24, // daily
    instantAlerts: false,
    price: 0,
  },
  pro: {
    label: "Pro",
    maxTrackers: 25,
    checkIntervalMinutes: 60, // hourly
    instantAlerts: true,
    price: 9,
  },
} as const satisfies Record<Plan, {
  label: string;
  maxTrackers: number;
  checkIntervalMinutes: number;
  instantAlerts: boolean;
  price: number;
}>;

export function planFor(plan: string | null | undefined) {
  return plan === "pro" ? PLANS.pro : PLANS.free;
}
