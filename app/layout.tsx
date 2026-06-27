import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { niche } from "@/lib/niche.config";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: niche.seo.title,
  description: niche.seo.description,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  verification: { google: "5MZ1P4JiOyDE-QHZwqoHgYKhZ2jUQ2ECeCT5X1NyA9M" },
  openGraph: {
    title: niche.seo.title,
    description: niche.seo.description,
    siteName: niche.brand,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: niche.seo.title,
    description: niche.seo.description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body className="min-h-screen font-sans antialiased">
        <header className="sticky top-0 z-50 glass border-x-0 border-t-0">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-extrabold tracking-tight">
              <span className="text-gradient">{niche.brand}</span>
            </Link>
            <div className="flex items-center gap-1 text-sm sm:gap-4">
              <Link href="/directory" className="rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-white/60 hover:text-slate-900">Directory</Link>
              <Link href="/pricing" className="rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-white/60 hover:text-slate-900">Pricing</Link>
              <Link href="/dashboard" className="hidden rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-white/60 hover:text-slate-900 sm:block">Dashboard</Link>
              <Link href="/login" className="btn-glow rounded-xl px-4 py-2 font-semibold">
                Sign in
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-12 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-800">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-800">Terms</Link>
            <span className="ml-auto">© {new Date().getFullYear()} {niche.brand}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
