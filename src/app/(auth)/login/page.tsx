"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BaoLogo } from "@/components/BaoLogo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "verifying">(
    "idle",
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "link"
      ? "That link didn't work — it may have expired, or opened in a different browser. Enter your email again and use the 6-digit code from the email instead."
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

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const token = code.trim();
    if (token.length < 6) return;
    setState("verifying");
    setError(null);
    const supabase = createClient();
    // Works in any browser — no same-browser handshake needed.
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    if (error) {
      setState("sent");
      setError(
        /expired|invalid/i.test(error.message)
          ? "That code didn't work — check for typos, or request a new one."
          : error.message,
      );
    } else {
      router.push("/chats");
      router.refresh();
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

        {state === "sent" || state === "verifying" ? (
          <div className="mt-6 flex flex-col gap-3">
            <div className="rounded-[14px] bg-bao-steam p-4 text-center text-[15px]">
              Check your email ✉️
              <p className="mt-1 text-sm text-bao-mute">
                We sent a sign-in link and a 6-digit code to {email.trim()}.
                Tap the link, or enter the code here.
              </p>
            </div>
            <form onSubmit={verifyCode} className="flex flex-col gap-3">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="6-digit code"
                aria-label="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-12 rounded-full border border-bao-steam bg-bao-cream px-5 text-center text-lg tracking-[0.3em] outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-bao-mute focus:border-bao-bao"
              />
              <button
                type="submit"
                disabled={code.trim().length < 6 || state === "verifying"}
                className="h-12 rounded-full bg-bao-bao text-[15px] font-semibold text-bao-ink transition-opacity disabled:opacity-50"
              >
                {state === "verifying" ? "Verifying…" : "Verify code"}
              </button>
            </form>
            {error && (
              <p role="alert" className="text-center text-sm text-bao-danger">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setState("idle");
                setCode("");
                setError(null);
              }}
              className="text-sm text-bao-mute underline"
            >
              Use a different email
            </button>
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
