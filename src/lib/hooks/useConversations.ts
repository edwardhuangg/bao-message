"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  ChatListEntry,
  Conversation,
  MemberWithProfile,
  Message,
} from "@/lib/supabase/types";

interface ConversationRow extends Conversation {
  conversation_members: MemberWithProfile[];
}

export function useConversations(myId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<ChatListEntry[] | null>(null);

  const reload = useCallback(async () => {
    // RLS limits this to conversations I'm a member of.
    const { data: convs } = await supabase
      .from("conversations")
      .select("*, conversation_members(*, profiles(*))");
    const rows = (convs as ConversationRow[]) ?? [];
    if (rows.length === 0) {
      setEntries([]);
      return;
    }

    // Latest messages across my conversations; reduce to one per conversation.
    // Tiny scale: 200 rows comfortably covers a handful of chats.
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .in(
        "conversation_id",
        rows.map((c) => c.id),
      )
      .order("created_at", { ascending: false })
      .limit(200);

    const lastByConv = new Map<string, Message>();
    for (const m of (msgs as Message[]) ?? []) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
    }

    const list: ChatListEntry[] = rows.map((c) => {
      const { conversation_members: members, ...conversation } = c;
      return {
        conversation,
        members,
        lastMessage: lastByConv.get(c.id) ?? null,
        myLastReadAt:
          members.find((m) => m.user_id === myId)?.last_read_at ?? null,
      };
    });

    list.sort((a, b) => {
      const ta = a.lastMessage?.created_at ?? a.conversation.created_at;
      const tb = b.lastMessage?.created_at ?? b.conversation.created_at;
      return tb.localeCompare(ta);
    });
    setEntries(list);
  }, [supabase, myId]);

  useEffect(() => {
    // reload() awaits network before any setState, so no cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();

    // Any new message I can see, or being added to a conversation, refreshes
    // the list. Cheap at this scale.
    const channel = supabase
      .channel("chat-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${myId}`,
        },
        () => void reload(),
      )
      .subscribe();

    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [supabase, reload, myId]);

  return { entries, reload };
}
