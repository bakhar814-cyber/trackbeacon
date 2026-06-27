import { PLANS } from "@/lib/plans";
import { UpgradeButton } from "./upgrade-button";

export const metadata = { title: "Pricing" };

export default function Pricing() {
  return (
    <div className="py-8">
      <h1 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
        Simple <span className="text-gradient">pricing</span>
      </h1>
      <p className="mt-2 text-center text-slate-600">Start free. Upgrade when you want more.</p>
      <div className="mx-auto mt-10 grid max-w-2xl gap-6 sm:grid-cols-2" style={{ perspective: "1200px" }}>
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
    <div
      className={
        "card-3d relative rounded-3xl p-6 " +
        (highlight
          ? "bg-gradient-to-br from-indigo-600 via-indigo-700 to-cyan-700 text-white shadow-glow ring-1 ring-white/20"
          : "glass text-slate-100")
      }
    >
      {highlight && (
        <span className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-3 py-1 text-xs font-bold text-white shadow-glow">
          Most popular
        </span>
      )}
      <h2 className={"font-semibold " + (highlight ? "text-white/80" : "text-slate-400")}>{name}</h2>
      <p className="mt-2 text-4xl font-extrabold tracking-tight">{price}</p>
      <ul className={"mt-5 space-y-2.5 text-sm " + (highlight ? "text-white/90" : "text-slate-300")}>
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span className={highlight ? "text-cyan-200" : "text-indigo-300"}>✓</span> {f}
          </li>
        ))}
      </ul>
      <div className="mt-7">{cta}</div>
    </div>
  );
}
