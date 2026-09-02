"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { TopBar } from "@/components/TopBar";
import { Avatar } from "@/components/Avatar";
import { AVATAR_COLORS, AVATAR_EMOJI } from "@/components/WelcomeForm";

export default function ProfilePage() {
  const { userId, email, profile, setProfile } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

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
