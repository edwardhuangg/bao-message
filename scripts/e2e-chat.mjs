// End-to-end chat flow against the live backend, mirroring the app's queries:
// A creates a chat with B, B receives A's message over Realtime, B replies,
// A reads it back. Throwaway users, cleaned up after.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const suffix = Math.random().toString(36).slice(2, 8);
const emails = [`e2e-a-${suffix}@example.com`, `e2e-b-${suffix}@example.com`];
const password = `E2e-${suffix}!x`;

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const users = [];
try {
  await admin.from("allowlist").insert(emails.map((email) => ({ email, note: "e2e (temp)" })));
  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`createUser: ${error.message}`);
    users.push(data.user);
  }
  const [userA, userB] = users;
  const clientA = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const clientB = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: sessA } = await clientA.auth.signInWithPassword({ email: emails[0], password });
  const { data: sessB } = await clientB.auth.signInWithPassword({ email: emails[1], password });
  // Node: make sure the websocket carries B's JWT so RLS lets events through.
  await clientB.realtime.setAuth(sessB.session.access_token);
  await clientA.from("profiles").insert({ id: userA.id, display_name: "E2E A" });
  await clientB.from("profiles").insert({ id: userB.id, display_name: "E2E B" });

  // A starts a chat with B — exactly what NewChatSheet does.
  const convId = crypto.randomUUID();
  const { error: e1 } = await clientA.from("conversations").insert({ id: convId, created_by: userA.id, is_group: false });
  check("A creates conversation", !e1, e1?.message);
  const { error: e2 } = await clientA.from("conversation_members").insert({ conversation_id: convId, user_id: userA.id });
  check("A joins it", !e2, e2?.message);
  const { error: e3 } = await clientA.from("conversation_members").insert({ conversation_id: convId, user_id: userB.id });
  check("A adds B", !e3, e3?.message);

  // B subscribes to Realtime like useMessages does.
  const received = [];
  const channel = clientB
    .channel(`messages:${convId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
      (payload) => received.push(payload.new),
    );
  const subscribed = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 10000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") { clearTimeout(t); resolve(true); }
    });
  });
  check("B's realtime channel subscribes", subscribed);

  // A sends; B should get it pushed over the socket.
  const msgId = crypto.randomUUID();
  const { error: e4 } = await clientA.from("messages").insert({ id: msgId, conversation_id: convId, sender_id: userA.id, body: "hello from A 🥟" });
  check("A sends a message", !e4, e4?.message);
  const gotRealtime = await new Promise((resolve) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (received.some((m) => m.id === msgId)) { clearInterval(iv); resolve(true); }
      else if (Date.now() - t0 > 25000) { clearInterval(iv); resolve(false); }
    }, 100);
  });
  check("B receives it via Realtime push", gotRealtime);

  // B replies; A reads history.
  const replyId = crypto.randomUUID();
  const { error: e5 } = await clientB.from("messages").insert({ id: replyId, conversation_id: convId, sender_id: userB.id, body: "hi A!" });
  check("B replies", !e5, e5?.message);
  const { data: history } = await clientA.from("messages").select("*").eq("conversation_id", convId).order("created_at");
  check("A reads both messages back", (history ?? []).length === 2);

  // B updates last_read_at like the app's markRead.
  const { error: e6 } = await clientB.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", convId).eq("user_id", userB.id);
  check("B marks the chat read", !e6, e6?.message);

  await clientB.removeChannel(channel);
} catch (e) {
  console.error("ERROR:", e.message);
  failures++;
} finally {
  for (const u of users) await admin.auth.admin.deleteUser(u.id).catch(() => {});
  await admin.from("allowlist").delete().in("email", emails);
}

console.log(failures === 0 ? "\nE2E chat flow: ALL PASS ✅" : `\nE2E chat flow: ${failures} FAILURE(S) ❌`);
process.exit(failures === 0 ? 0 : 1);
