"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { niche } from "@/lib/niche.config";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="text-2xl font-bold">Sign in to {niche.brand}</h1>
      {sent ? (
        <p className="mt-6 rounded-lg bg-green-50 p-4 text-green-800">
          Check your inbox — we sent a magic link to <strong>{email}</strong>.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <button disabled={loading} className="w-full rounded-md bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-50">
            {loading ? "Sending…" : "Email me a magic link"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
