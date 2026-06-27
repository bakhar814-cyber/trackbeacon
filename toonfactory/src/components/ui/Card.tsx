import * as React from "react";

export function Card({
  className = "",
  children,
  as: Tag = "div",
  hover = false,
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "article";
  hover?: boolean;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`card ${hover ? "card-hover" : ""} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title = "No data yet",
  hint,
  icon,
}: {
  title?: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
      <div className="mb-2 text-slate-600">{icon ?? <DefaultIcon />}</div>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function DefaultIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8">
      <path d="M4 7h16v12H4z" strokeLinejoin="round" />
      <path d="M4 7l3-3h6l3 3" strokeLinejoin="round" />
    </svg>
  );
}
