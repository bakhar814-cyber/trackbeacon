import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { niche } from "@/lib/niche.config";

export const metadata: Metadata = {
  title: niche.seo.title,
  description: niche.seo.description,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  verification: { google: "5MZ1P4JiOyDE-QHZwqoHgYKhZ2jUQ2ECeCT5X1NyA9M" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-bold tracking-tight text-lg">
              {niche.brand}
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/directory" className="text-slate-600 hover:text-slate-900">Directory</Link>
              <Link href="/pricing" className="text-slate-600 hover:text-slate-900">Pricing</Link>
              <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">Dashboard</Link>
              <Link href="/login" className="rounded-md bg-accent px-3 py-1.5 font-medium text-white hover:opacity-90">
                Sign in
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-12 text-xs text-slate-400">
          <div className="flex gap-4">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <span>© {new Date().getFullYear()} {niche.brand}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
