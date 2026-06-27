"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string };

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/production", label: "Production", icon: "M12 8v8m-4-4h8M4 6h16v12H4z" },
  { href: "/episodes", label: "Episodes", icon: "M4 5h16v14H4zM4 9h16M9 5v14" },
  { href: "/story", label: "Story Universe", icon: "M12 4a8 8 0 100 16 8 8 0 000-16zm0 0v16" },
  { href: "/analytics", label: "Analytics", icon: "M4 19V5m0 14h16M8 15l3-4 3 2 4-6" },
  { href: "/monetization", label: "Monetization", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
  { href: "/costs", label: "Costs", icon: "M3 6h18v12H3zM3 10h18M7 15h4" },
  { href: "/logs", label: "Logs", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/settings", label: "Settings", icon: "M12 9a3 3 0 100 6 3 3 0 000-6zm8 3l2 1-2 4-2-1m-12 0l-2 1-2-4 2-1" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname() ?? "/";

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/5 bg-panel/60 backdrop-blur-xl lg:flex">
        <Brand />
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <Footer />
      </aside>

      {/* Mobile horizontal nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 overflow-x-auto border-t border-white/5 bg-panel/90 px-2 py-1.5 backdrop-blur-xl lg:hidden">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[64px] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] ${
                active ? "bg-brand/15 text-brand-soft" : "text-slate-400"
              }`}
            >
              <Icon path={item.icon} className="h-4 w-4" />
              <span className="truncate">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-brand/15 text-white shadow-[inset_0_0_0_1px_rgba(124,92,255,0.25)]"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      <Icon
        path={item.icon}
        className={`h-[18px] w-[18px] shrink-0 ${active ? "text-brand-soft" : "text-slate-500 group-hover:text-slate-300"}`}
      />
      <span>{item.label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand" />}
    </Link>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-accent text-sm font-black text-white shadow-glow">
        TF
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight text-white">ToonFactory</div>
        <div className="text-[11px] text-slate-500">AI Cartoon Studio</div>
      </div>
    </Link>
  );
}

function Footer() {
  return (
    <div className="border-t border-white/5 px-5 py-4 text-[11px] text-slate-500">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-good" />
        Autonomous mode
      </div>
      <div className="mt-1 text-slate-600">v1.0 · mission control</div>
    </div>
  );
}

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}
