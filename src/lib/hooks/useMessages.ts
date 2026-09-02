"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCrypto } from "@/components/CryptoProvider";
import { decryptBody, encryptBody } from "@/lib/crypto/box";
import {
  CONTROL_PREFIX,
  CTRL_KEY_REQUEST,
  CTRL_LEFT,
  type LocalMessage,
  type Message,
} from "@/lib/supabase/types";

// Guarded, localStorage-backed "at most once per interval" helper so multiple
// tabs/members don't stampede control actions.
function onceEvery(key: string, ms: number): boolean {
  try {
    const last = Number(localStorage.getItem(key) ?? 0);
    if (Date.now() - last < ms) return false;
    localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

export function useMessages(conversationId: string, myId: string) {
  const supabase = useMemo(() => createClient(), []);
  const crypto = useCrypto();
  const [messages, setMessages] = useState<LocalMessage[] | null>(null);
  const [connected, setConnected] = useState(true);
  const [hasKey, setHasKey] = useState(true);
  const keysRef = useRef<Map<number, Uint8Array>>(new Map());

  const markRead = useCallback(() => {
    void supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", myId);
  }, [supabase, conversationId, myId]);

  const decorate = useCallback((m: Message): LocalMessage => {
    if (!m.ciphertext || !m.nonce) return { ...m }; // legacy plaintext row
    const key = keysRef.current.get(m.key_version);
    const body = key ? decryptBody(m.ciphertext, m.nonce, key) : null;
    return body !== null
      ? { ...m, body }
      : { ...m, body: null, decryptFailed: true };
  }, []);

  const refreshKeys = useCallback(async () => {
    keysRef.current = await crypto.getConvKeys(conversationId);
    setHasKey(keysRef.current.size > 0);
    return keysRef.current;
  }, [crypto, conversationId]);

  // Rotate for a member who lost their key / just joined the E2EE era —
  // any member with the current key can answer; the guard keeps it to one
  // rotation per conversation per few minutes.
  const answerKeyRequest = useCallback(async () => {
    if (keysRef.current.size === 0) return;
    if (!onceEvery(`bao:rotate:${conversationId}`, 5 * 60 * 1000)) return;
    await crypto.rotateConvKey(conversationId);
  }, [crypto, conversationId]);

  const handleControl = useCallback(
    (m: Message) => {
      if (m.sender_id === myId) return;
      if (m.body === CTRL_KEY_REQUEST) void answerKeyRequest();
      if (m.body === CTRL_LEFT) {
        // Exclude the leaver from the fresh key.
        if (onceEvery(`bao:rotate:${conversationId}`, 60 * 1000)) {
          void crypto.rotateConvKey(conversationId, {
            excludeUserId: m.sender_id,
          });
        }
      }
    },
    [myId, conversationId, crypto, answerKeyRequest],
  );

  const isControl = (m: Message) => !!m.body?.startsWith(CONTROL_PREFIX);

  // Insert or reconcile (by id) a message into ordered state.
  const upsert = useCallback(
    (incoming: Message) => {
      const local = decorate(incoming);
      setMessages((prev) => {
        if (!prev) return prev;
        const i = prev.findIndex((m) => m.id === incoming.id);
        if (i >= 0) {
          const next = [...prev];
          // Confirmed: drop sendState, keep the plaintext we typed.
          next[i] = { ...local, body: local.body ?? next[i].body };
          return next;
        }
        return [...prev, local];
      });
    },
    [decorate],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (crypto.status !== "ready") return;
      const keys = await refreshKeys();
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      const rows = ((data as Message[]) ?? []).reverse();
      const visible = rows.filter((m) => !isControl(m));
      setMessages(visible.map(decorate));
      markRead();

      // Locked out of an encrypted chat? Ask friends' clients to re-share,
      // at most once an hour.
      const locked =
        keys.size === 0 && rows.some((m) => m.ciphertext !== null);
      if (locked && onceEvery(`bao:keyreq:${conversationId}`, 60 * 60 * 1000)) {
        await supabase.from("messages").insert({
          id: window.crypto.randomUUID(),
          conversation_id: conversationId,
          sender_id: myId,
          body: CTRL_KEY_REQUEST,
        });
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
          const m = payload.new as Message;
          if (isControl(m)) {
            handleControl(m);
            return;
          }
          upsert(m);
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
  }, [
    supabase,
    conversationId,
    myId,
    crypto.status,
    refreshKeys,
    decorate,
    markRead,
    upsert,
    handleControl,
  ]);

  // While locked out, poll for a re-shared key every 10s and reload on arrival.
  useEffect(() => {
    if (hasKey || crypto.status !== "ready") return;
    const iv = setInterval(async () => {
      crypto.invalidate(conversationId);
      const keys = await refreshKeys();
      if (keys.size > 0) {
        const { data } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(100);
        const rows = ((data as Message[]) ?? []).reverse();
        setMessages(rows.filter((m) => !isControl(m)).map(decorate));
      }
    }, 10_000);
    return () => clearInterval(iv);
  }, [hasKey, crypto, conversationId, refreshKeys, supabase, decorate]);

  const send = useCallback(
    async (body: string, existingId?: string) => {
      const cur = await crypto.currentKey(conversationId);
      if (!cur) return; // composer is disabled in this state anyway
      const id = existingId ?? window.crypto.randomUUID();
      const { ciphertext, nonce } = encryptBody(body, cur.key);
      const optimistic: LocalMessage = {
        id,
        conversation_id: conversationId,
        sender_id: myId,
        body,
        ciphertext,
        nonce,
        key_version: cur.version,
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
        ciphertext,
        nonce,
        key_version: cur.version,
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
    [supabase, crypto, conversationId, myId],
  );

  const retry = useCallback(
    (m: LocalMessage) => {
      if (m.body) void send(m.body, m.id);
    },
    [send],
  );

  // Plaintext control signal (e.g. announcing a leave so others rotate).
  const sendControl = useCallback(
    async (body: string) => {
      await supabase.from("messages").insert({
        id: window.crypto.randomUUID(),
        conversation_id: conversationId,
        sender_id: myId,
        body,
      });
    },
    [supabase, conversationId, myId],
  );

  return { messages, connected, hasKey, send, retry, sendControl };
}
