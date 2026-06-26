"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { niche } from "@/lib/niche.config";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) setError(error.message);
    else router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="text-2xl font-bold">Sign in to {niche.brand}</h1>
      {step === "email" ? (
        <form onSubmit={sendCode} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <button
            disabled={loading}
            className="w-full rounded-md bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Sending…" : "Email me a code"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 space-y-3">
          <p className="text-sm text-slate-600">
            We emailed a code to <strong>{email}</strong>. Enter it below.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="12345678"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-widest"
          />
          <button
            disabled={loading}
            className="w-full rounded-md bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify & sign in"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="w-full text-sm text-slate-500 underline"
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
