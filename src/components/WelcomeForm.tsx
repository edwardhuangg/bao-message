"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { BaoLogo } from "@/components/BaoLogo";

export const AVATAR_COLORS = [
  "#FFD6A5", // bao
  "#FFC4C4",
  "#BFDBCE",
  "#B5D8F2",
  "#E3C8F5",
  "#F5E1A4",
  "#C9E4C5",
  "#F2C6B4",
];

export const AVATAR_EMOJI = ["🥟", "🍜", "🍙", "🌱", "🐣", "🐻", "🍵", "⭐️"];

export function WelcomeForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").insert({
      id: userId,
      display_name: trimmed,
      avatar_color: color,
      avatar_emoji: emoji,
    });
    if (error) {
      setSaving(false);
      setError(error.message);
    } else {
      router.replace("/chats");
      router.refresh();
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <form
        onSubmit={save}
        className="flex w-full max-w-sm flex-col gap-5 rounded-[14px] bg-white p-8 shadow-[0_2px_16px_rgba(43,43,43,0.08)]"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <BaoLogo size={64} />
          <h1 className="text-xl font-bold">Almost there!</h1>
          <p className="text-sm text-bao-mute">
            Pick a name and an avatar for the chat.
          </p>
        </div>

        <div className="flex items-center justify-center">
          <Avatar
            profile={{
              display_name: name || "?",
              avatar_color: color,
              avatar_emoji: emoji,
            }}
            size="lg"
          />
        </div>

        <input
          type="text"
          required
          maxLength={40}
          placeholder="Display name"
          aria-label="Display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 rounded-full border border-bao-steam bg-bao-cream px-5 text-[15px] outline-none placeholder:text-bao-mute focus:border-bao-bao"
        />

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
          disabled={saving || !name.trim()}
          className="h-12 rounded-full bg-bao-bao text-[15px] font-semibold text-bao-ink transition-opacity disabled:opacity-60"
        >
          {saving ? "Saving…" : "Let's chat"}
        </button>
        {error && (
          <p role="alert" className="text-center text-sm text-bao-danger">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
