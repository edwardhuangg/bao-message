"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { useCrypto } from "@/components/CryptoProvider";
import { TopBar } from "@/components/TopBar";
import { Avatar } from "@/components/Avatar";
import { AVATAR_COLORS, AVATAR_EMOJI } from "@/components/WelcomeForm";

export default function ProfilePage() {
  const { userId, email, profile, setProfile } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const crypto = useCrypto();
  const router = useRouter();
  const [backupPass, setBackupPass] = useState("");
  const [backupState, setBackupState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [backupError, setBackupError] = useState<string | null>(null);

  const [name, setName] = useState(profile.display_name);
  const [color, setColor] = useState(profile.avatar_color);
  const [emoji, setEmoji] = useState<string | null>(profile.avatar_emoji);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name.trim() !== profile.display_name ||
    color !== profile.avatar_color ||
    emoji !== profile.avatar_emoji;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    const updates = {
      display_name: trimmed,
      avatar_color: color,
      avatar_emoji: emoji,
    };
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      setProfile({ ...profile, ...updates });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        left={
          <Link
            href="/chats"
            aria-label="Back to chats"
            className="flex h-11 w-11 items-center justify-center text-bao-ink"
          >
            <ChevronLeft size={24} />
          </Link>
        }
        center={<h1 className="text-center font-semibold">Profile</h1>}
      />

      <form onSubmit={save} className="flex flex-col gap-6 p-6">
        <div className="flex flex-col items-center gap-3">
          <Avatar
            profile={{
              display_name: name || "?",
              avatar_color: color,
              avatar_emoji: emoji,
            }}
            size="lg"
          />
          <p className="text-sm text-bao-mute">{email}</p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-bao-mute">Display name</span>
          <input
            type="text"
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-full border border-bao-steam bg-white px-5 text-[15px] outline-none focus:border-bao-bao"
          />
        </label>

        <div>
          <p className="mb-2 text-sm text-bao-mute">Color</p>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Avatar color ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`h-11 w-11 rounded-full border-2 ${
                  color === c ? "border-bao-ink" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-bao-mute">Emoji (optional)</p>
          <div className="flex flex-wrap gap-2">
            {AVATAR_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={emoji === e}
                onClick={() => setEmoji(emoji === e ? null : e)}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${
                  emoji === e ? "bg-bao-bao" : "bg-bao-steam"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={!dirty || saving || !name.trim()}
          className="h-12 rounded-full bg-bao-bao text-[15px] font-semibold text-bao-ink transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
        {error && (
          <p role="alert" className="text-center text-sm text-bao-danger">
            {error}
          </p>
        )}

        <div className="rounded-[14px] bg-white p-4">
          <p className="font-semibold">Encryption</p>
          <p className="mt-1 text-sm text-bao-mute">
            {crypto.status === "ready"
              ? "✓ Messages are end-to-end encrypted. This device holds your key."
              : "Setting up…"}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="password"
              autoComplete="new-password"
              placeholder="New backup passphrase"
              aria-label="New backup passphrase"
              value={backupPass}
              onChange={(e) => {
                setBackupPass(e.target.value);
                setBackupState("idle");
              }}
              className="h-11 min-w-0 flex-1 rounded-full border border-bao-steam bg-bao-cream px-4 text-[15px] outline-none focus:border-bao-bao"
            />
            <button
              type="button"
              disabled={backupPass.length < 8 || backupState === "saving"}
              onClick={async () => {
                setBackupState("saving");
                setBackupError(null);
                const err = await crypto.updateBackupPassphrase(backupPass);
                if (err) {
                  setBackupState("error");
                  setBackupError(err);
                } else {
                  setBackupState("saved");
                  setBackupPass("");
                }
              }}
              className="h-11 shrink-0 rounded-full bg-bao-bao px-4 text-sm font-semibold text-bao-ink disabled:opacity-50"
            >
              {backupState === "saving"
                ? "Saving…"
                : backupState === "saved"
                  ? "Saved ✓"
                  : "Update"}
            </button>
          </div>
          <p className="mt-2 text-xs text-bao-mute">
            The passphrase (8+ characters) unlocks your history on a new phone.
            If you lose your devices and forget it, old messages are gone for
            good.
          </p>
          {backupError && (
            <p role="alert" className="mt-1 text-sm text-bao-danger">
              {backupError}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={signOut}
          className="h-12 rounded-full border border-bao-steam text-[15px] font-semibold text-bao-mute"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
