"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BaoLogo } from "@/components/BaoLogo";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function friendly(message: string): string {
    if (/guest list|database error|signups not allowed/i.test(message))
      return "This email isn't on the guest list yet — ask the host.";
    if (/invalid login credentials/i.test(message))
      return "Wrong email or password. New here? Tap “Create account” below.";
    if (/already registered/i.test(message))
      return "You already have an account — sign in instead.";
    if (/email not confirmed/i.test(message))
      return "Almost! Ask the host to flip the “Confirm email” setting off, then sign in again.";
    return message;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mail = email.trim();
    if (!mail || password.length < 8) {
      setError("Password needs at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
      });
      if (error) {
        setBusy(false);
        setError(friendly(error.message));
        return;
      }
      // With "Confirm email" off, signUp returns a live session. If it's
      // still on, fall through to signIn so the error message explains.
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: mail,
          password,
        });
        if (signInError) {
          setBusy(false);
          setError(friendly(signInError.message));
          return;
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: mail,
        password,
      });
      if (error) {
        setBusy(false);
        setError(friendly(error.message));
        return;
      }
    }
    router.push("/chats");
    router.refresh();
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

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
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
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "Choose a password (8+)" : "Password"}
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-full border border-bao-steam bg-bao-cream px-5 text-[15px] outline-none placeholder:text-bao-mute focus:border-bao-bao"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-12 rounded-full bg-bao-bao text-[15px] font-semibold text-bao-ink transition-opacity disabled:opacity-60"
          >
            {busy
              ? "One sec…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
          {error && (
            <p role="alert" className="text-center text-sm text-bao-danger">
              {error}
            </p>
          )}
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="mt-4 w-full text-center text-sm text-bao-mute underline"
        >
          {mode === "signin"
            ? "New here? Create account"
            : "Have an account? Sign in"}
        </button>
        <p className="mt-3 text-center text-xs text-bao-mute">
          Forgot your password? Ask the host to reset it.
        </p>
      </div>
    </main>
  );
}
