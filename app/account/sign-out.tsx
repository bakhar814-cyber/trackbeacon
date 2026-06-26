"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOut() {
  const router = useRouter();
  return (
    <button
      onClick={async () => { await createClient().auth.signOut(); router.push("/"); router.refresh(); }}
      className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
    >
      Sign out
    </button>
  );
}
