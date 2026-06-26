import { PLANS } from "@/lib/plans";
import { UpgradeButton } from "./upgrade-button";

export const metadata = { title: "Pricing" };

export default function Pricing() {
  return (
    <div className="py-8">
      <h1 className="text-center text-3xl font-bold">Simple pricing</h1>
      <p className="mt-2 text-center text-slate-600">Start free. Upgrade when you want more.</p>
      <div className="mx-auto mt-10 grid max-w-2xl gap-6 sm:grid-cols-2">
        <Card
          name={PLANS.free.label}
          price="$0"
          features={[`${PLANS.free.maxTrackers} trackers`, "Daily checks", "Email alerts"]}
        />
        <Card
          highlight
          name={PLANS.pro.label}
          price={`$${PLANS.pro.price}/mo`}
          features={[`${PLANS.pro.maxTrackers} trackers`, "Hourly checks", "Instant alerts", "Price history"]}
          cta={<UpgradeButton />}
        />
      </div>
    </div>
  );
}

function Card({ name, price, features, highlight, cta }: {
  name: string; price: string; features: string[]; highlight?: boolean; cta?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border bg-white p-6 ${highlight ? "border-accent shadow-lg" : "border-slate-200"}`}>
      <h2 className="font-semibold">{name}</h2>
      <p className="mt-2 text-3xl font-bold">{price}</p>
      <ul className="mt-4 space-y-2 text-sm text-slate-600">
        {features.map((f) => <li key={f}>✓ {f}</li>)}
      </ul>
      <div className="mt-6">{cta}</div>
    </div>
  );
}
