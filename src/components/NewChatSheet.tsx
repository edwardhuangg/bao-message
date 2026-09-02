"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ChatListEntry, Profile } from "@/lib/supabase/types";
import { Avatar } from "@/components/Avatar";

export function NewChatSheet({
  myId,
  existing,
  onClose,
}: {
  myId: string;
  existing: ChatListEntry[];
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [people, setPeople] = useState<Profile[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from("profiles")
      .select("*")
      .neq("id", myId)
      .order("display_name")
      .then(({ data }) => setPeople((data as Profile[]) ?? []));
  }, [supabase, myId]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function start() {
    const ids = [...picked];
    if (ids.length === 0) return;

    // Reuse an existing 1:1 instead of creating a duplicate.
    if (ids.length === 1) {
      const dupe = existing.find((e) => {
        const others = e.members.filter((m) => m.user_id !== myId);
        return (
          !e.conversation.is_group &&
          others.length === 1 &&
          others[0].user_id === ids[0]
        );
      });
      if (dupe) {
        router.push(`/chats/${dupe.conversation.id}`);
        onClose();
        return;
      }
    }

    setCreating(true);
    setError(null);
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({ created_by: myId, is_group: ids.length > 1 })
      .select()
      .single();
    if (convError || !conv) {
      setCreating(false);
      setError(convError?.message ?? "Could not create the chat.");
      return;
    }

    // Self first (RLS: creator adds self), then the others (RLS: member adds).
    const { error: selfError } = await supabase
      .from("conversation_members")
      .insert({ conversation_id: conv.id, user_id: myId });
    const { error: othersError } = selfError
      ? { error: selfError }
      : await supabase
          .from("conversation_members")
          .insert(
            ids.map((user_id) => ({ conversation_id: conv.id, user_id })),
          );
    if (selfError || othersError) {
      setCreating(false);
      setError((selfError ?? othersError)?.message ?? "Could not add members.");
      return;
    }

    router.push(`/chats/${conv.id}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-bao-ink/30"
        onClick={onClose}
      />
      <div className="relative flex max-h-[80vh] w-full max-w-[480px] flex-col rounded-t-[14px] bg-bao-cream pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-lg font-bold">New chat</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-bao-mute"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {people === null ? (
            <p className="px-3 py-6 text-center text-sm text-bao-mute">
              Loading…
            </p>
          ) : people.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-bao-mute">
              No one else is here yet — invite friends to the guest list first.
            </p>
          ) : (
            people.map((p) => (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                aria-pressed={picked.has(p.id)}
                className={`flex min-h-[56px] w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left ${
                  picked.has(p.id) ? "bg-bao-bao/50" : "active:bg-bao-steam/60"
                }`}
              >
                <Avatar profile={p} />
                <span className="flex-1 truncate font-medium">
                  {p.display_name}
                </span>
                <span
                  aria-hidden
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                    picked.has(p.id)
                      ? "border-bao-ink bg-bao-ink text-bao-cream"
                      : "border-bao-mute text-transparent"
                  }`}
                >
                  ✓
                </span>
              </button>
            ))
          )}
        </div>

        {error && (
          <p role="alert" className="px-5 pb-2 text-sm text-bao-danger">
            {error}
          </p>
        )}
        <div className="px-5">
          <button
            onClick={start}
            disabled={picked.size === 0 || creating}
            className="h-12 w-full rounded-full bg-bao-bao text-[15px] font-semibold text-bao-ink transition-opacity disabled:opacity-50"
          >
            {creating
              ? "Starting…"
              : picked.size > 1
                ? `Start group (${picked.size})`
                : "Start chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
