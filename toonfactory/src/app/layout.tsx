import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "ToonFactory",
  description: "AI-powered YouTube cartoon automation — mission control.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
            <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/5 bg-ink/70 px-4 backdrop-blur-md sm:px-6 lg:px-8">
              <div className="flex items-center gap-3 lg:hidden">
                <span className="text-sm font-semibold tracking-tight text-white">
                  ToonFactory
                </span>
              </div>
              <div className="hidden items-center gap-2 lg:flex">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-good" />
                <span className="text-xs text-slate-400">
                  Pipeline online
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden text-xs text-slate-500 sm:inline">
                  Mission Control
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent text-xs font-bold text-white shadow-glow">
                  TF
                </div>
              </div>
            </header>
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
