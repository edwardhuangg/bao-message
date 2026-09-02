"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BaoLogo } from "@/components/BaoLogo";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "link"
      ? "That link didn't work — it may have expired. Try again."
      : null,
  );

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setState("idle");
      // The allowlist trigger rejects unknown emails at signup time; Supabase
      // surfaces it as a generic database/signup error.
      const notInvited =
        /guest list|database error|signups not allowed/i.test(error.message);
      setError(
        notInvited
          ? "This email isn't on the guest list yet — ask the host."
          : error.message,
      );
    } else {
      setState("sent");
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[14px] bg-white p-8 shadow-[0_2px_16px_rgba(43,43,43,0.08)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <BaoLogo size={80} />
          <h1 className="text-2xl font-bold">Welcome to Bao</h1>
          <p className="text-sm text-bao-mute">
            A cozy little chat for friends.
          </p>
        </div>

        {state === "sent" ? (
          <div className="mt-6 rounded-[14px] bg-bao-steam p-4 text-center text-[15px]">
            Check your email ✉️
            <p className="mt-1 text-sm text-bao-mute">
              We sent a sign-in link to {email.trim()}.
            </p>
          </div>
        ) : (
          <form onSubmit={sendLink} className="mt-6 flex flex-col gap-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-full border border-bao-steam bg-bao-cream px-5 text-[15px] outline-none placeholder:text-bao-mute focus:border-bao-bao"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="h-12 rounded-full bg-bao-bao text-[15px] font-semibold text-bao-ink transition-opacity disabled:opacity-60"
            >
              {state === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {error && (
              <p role="alert" className="text-center text-sm text-bao-danger">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
