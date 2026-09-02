"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ChevronLeft, MoreHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { useCrypto } from "@/components/CryptoProvider";
import { CTRL_LEFT } from "@/lib/supabase/types";
import { useMessages } from "@/lib/hooks/useMessages";
import { TopBar } from "@/components/TopBar";
import { Avatar } from "@/components/Avatar";
import { Bubble } from "@/components/Bubble";
import { Composer } from "@/components/Composer";
import {
  conversationName,
  dateDividerLabel,
  sameDay,
  withinGroupWindow,
} from "@/lib/format";
import type {
  Conversation,
  LocalMessage,
  MemberWithProfile,
} from "@/lib/supabase/types";

interface ConversationDetail extends Conversation {
  conversation_members: MemberWithProfile[];
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useApp();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const crypto = useCrypto();

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reshared, setReshared] = useState(false);
  const { messages, connected, hasKey, send, retry, sendControl } = useMessages(
    id,
    userId,
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [showNewPill, setShowNewPill] = useState(false);

  useEffect(() => {
    void supabase
      .from("conversations")
      .select("*, conversation_members(*, profiles(*))")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) router.replace("/chats");
        else setDetail(data as ConversationDetail);
      });
  }, [supabase, id, router]);

  // Stick to the bottom when new messages arrive, unless the reader has
  // scrolled up — then offer the "New" pill instead.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !messages) return;
    if (nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      setShowNewPill(false);
    } else {
      setShowNewPill(true);
    }
  }, [messages]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottomRef.current) setShowNewPill(false);
  }

  function jumpToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setShowNewPill(false);
  }

  async function leave() {
    // Announce first so remaining members' clients rotate the key without us.
    await sendControl(CTRL_LEFT).catch(() => {});
    await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", id)
      .eq("user_id", userId);
    router.replace("/chats");
  }

  async function reshareKeys() {
    const ok = await crypto.rotateConvKey(id);
    setReshared(ok);
    if (ok) setTimeout(() => setReshared(false), 3000);
  }

  const members = detail?.conversation_members ?? [];
  const byId = new Map(members.map((m) => [m.user_id, m.profiles]));
  const isGroup = detail?.is_group ?? false;
  const name = detail ? conversationName(detail, members, userId) : "";

  return (
    <div className="flex h-dvh flex-col">
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
        center={
          <h1 className="truncate text-center font-semibold">{name}</h1>
        }
        right={
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Conversation options"
            className="flex h-11 w-11 items-center justify-center text-bao-ink"
          >
            <MoreHorizontal size={22} />
          </button>
        }
      />

      {!connected && (
        <div className="bg-bao-steam px-4 py-1.5 text-center text-sm text-bao-mute">
          Reconnecting…
        </div>
      )}

      {!hasKey && (
        <div className="bg-bao-bao/40 px-4 py-2 text-center text-sm text-bao-ink">
          🔒 Waiting for a friend to share this chat&apos;s keys — this fixes
          itself when one of them opens the app.
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative flex-1 overflow-y-auto px-3 pb-3"
        aria-live="polite"
      >
        {messages?.map((m, i) => {
          const prev = messages[i - 1];
          const mine = m.sender_id === userId;
          const newDay = !prev || !sameDay(prev.created_at, m.created_at);
          const firstInRun =
            newDay ||
            !prev ||
            prev.sender_id !== m.sender_id ||
            !withinGroupWindow(prev.created_at, m.created_at);
          const sender = byId.get(m.sender_id);

          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-bao-steam px-3 py-1 text-[12px] text-bao-mute">
                    {dateDividerLabel(m.created_at)}
                  </span>
                </div>
              )}
              {!mine && isGroup && firstInRun && sender && (
                <p className="ml-11 mt-2 text-[12px] text-bao-mute">
                  {sender.display_name}
                </p>
              )}
              <div className="flex items-end gap-1.5">
                {!mine && (
                  <span className="w-7 shrink-0 self-end">
                    {firstInRun && sender && (
                      <Avatar profile={sender} size="sm" />
                    )}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <Bubble
                    message={m as LocalMessage}
                    mine={mine}
                    firstInRun={firstInRun}
                    onRetry={retry}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showNewPill && (
        <div className="pointer-events-none relative">
          <button
            onClick={jumpToBottom}
            className="pointer-events-auto absolute bottom-3 right-1/2 flex h-9 translate-x-1/2 items-center gap-1 rounded-full bg-bao-ink px-4 text-sm text-bao-cream shadow"
          >
            <ArrowDown size={14} /> New
          </button>
        </div>
      )}

      <Composer onSend={(text) => void send(text)} disabled={!hasKey} />

      {menuOpen && detail && (
        <div className="fixed inset-0 z-20 flex items-end justify-center">
          <button
            aria-label="Close"
            className="absolute inset-0 bg-bao-ink/30"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative w-full max-w-[480px] rounded-t-[14px] bg-bao-cream p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Members</h2>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full text-bao-mute"
              >
                <X size={22} />
              </button>
            </div>
            <ul className="mt-2">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 py-2">
                  <Avatar profile={m.profiles} size="sm" />
                  <span className="font-medium">
                    {m.profiles.display_name}
                    {m.user_id === userId && (
                      <span className="text-bao-mute"> (you)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <button
              onClick={reshareKeys}
              className="mt-4 h-12 w-full rounded-full border border-bao-steam text-[15px] font-semibold text-bao-ink"
            >
              {reshared ? "Keys re-shared ✓" : "Re-share encryption keys"}
            </button>
            <p className="mt-1 text-center text-xs text-bao-mute">
              Use this if someone says the chat is locked for them.
            </p>
            <button
              onClick={leave}
              className="mt-4 h-12 w-full rounded-full border border-bao-danger text-[15px] font-semibold text-bao-danger"
            >
              Leave chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
