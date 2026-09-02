"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LocalMessage, Message } from "@/lib/supabase/types";

export function useMessages(conversationId: string, myId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<LocalMessage[] | null>(null);
  const [connected, setConnected] = useState(true);

  const markRead = useCallback(() => {
    void supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", myId);
  }, [supabase, conversationId, myId]);

  // Insert or reconcile (by id) a message into ordered state.
  const upsert = useCallback((incoming: Message) => {
    setMessages((prev) => {
      if (!prev) return prev;
      const i = prev.findIndex((m) => m.id === incoming.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...incoming }; // confirmed: drops sendState
        return next;
      }
      return [...prev, { ...incoming }];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled) {
        setMessages(((data as Message[]) ?? []).reverse());
        markRead();
      }
    }
    void load();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          upsert(payload.new as Message);
          markRead();
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, markRead, upsert]);

  const send = useCallback(
    async (body: string, existingId?: string) => {
      const id = existingId ?? crypto.randomUUID();
      const optimistic: LocalMessage = {
        id,
        conversation_id: conversationId,
        sender_id: myId,
        body,
        ciphertext: null,
        nonce: null,
        key_version: 1,
        created_at: new Date().toISOString(),
        sendState: "pending",
      };
      setMessages((prev) => {
        if (!prev) return [optimistic];
        const i = prev.findIndex((m) => m.id === id);
        if (i >= 0) {
          const next = [...prev];
          next[i] = optimistic;
          return next;
        }
        return [...prev, optimistic];
      });

      const { error } = await supabase.from("messages").insert({
        id,
        conversation_id: conversationId,
        sender_id: myId,
        body,
      });

      setMessages((prev) =>
        prev
          ? prev.map((m) =>
              m.id === id
                ? { ...m, sendState: error ? "failed" : undefined }
                : m,
            )
          : prev,
      );
    },
    [supabase, conversationId, myId],
  );

  const retry = useCallback(
    (m: LocalMessage) => {
      if (m.body) void send(m.body, m.id);
    },
    [send],
  );

  return { messages, connected, send, retry };
}
