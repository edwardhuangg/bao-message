// RLS verification (HANDOFF.md Phase 1 §7): proves a signed-in user cannot
// read or write a conversation they aren't a member of.
//
// Needs SUPABASE_SERVICE_ROLE_KEY in .env.local (server-side only — this
// script runs on your machine, never in the app). It creates two throwaway
// users, has user A start a conversation, then checks user B sees nothing.
// Cleans up after itself.
//
// Run: node scripts/rls-check.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is empty in .env.local — copy it from Supabase → Project Settings → API keys (service_role) to run this check.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const suffix = Math.random().toString(36).slice(2, 8);
const emailA = `rls-a-${suffix}@example.com`;
const emailB = `rls-b-${suffix}@example.com`;
const password = `Rls-check-${suffix}!`;

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const createdUsers = [];
try {
  // Throwaway users must be allowlisted to get past the signup trigger.
  await admin.from("allowlist").insert([
    { email: emailA, note: "rls-check (temp)" },
    { email: emailB, note: "rls-check (temp)" },
  ]);

  for (const email of [emailA, emailB]) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    createdUsers.push(data.user);
  }
  const [userA, userB] = createdUsers;

  const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
  const clientB = createClient(url, anonKey, { auth: { persistSession: false } });
  for (const [client, email] of [[clientA, emailA], [clientB, emailB]]) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`signIn ${email}: ${error.message}`);
  }

  // A sets up a private conversation with a message.
  await clientA.from("profiles").insert({ id: userA.id, display_name: "RLS A" });
  await clientB.from("profiles").insert({ id: userB.id, display_name: "RLS B" });
  // Client-generated id — .select() on the insert would be blocked by the
  // membership SELECT policy until the member row below exists.
  const conv = { id: crypto.randomUUID() };
  const { error: convError } = await clientA
    .from("conversations")
    .insert({ id: conv.id, created_by: userA.id });
  if (convError) throw new Error(`create conversation: ${convError.message}`);
  const { error: joinError } = await clientA
    .from("conversation_members")
    .insert({ conversation_id: conv.id, user_id: userA.id });
  check("creator (A) can add themself as a member", !joinError, joinError?.message);
  const msgId = crypto.randomUUID();
  const { error: sendError } = await clientA.from("messages").insert({
    id: msgId,
    conversation_id: conv.id,
    sender_id: userA.id,
    body: "secret bao recipe",
  });
  check("member (A) can send a message", !sendError, sendError?.message);

  // The actual assertions: B must be locked out.
  const { data: bConvs } = await clientB
    .from("conversations")
    .select("*")
    .eq("id", conv.id);
  check("non-member (B) cannot see the conversation", (bConvs ?? []).length === 0);

  const { data: bMsgs } = await clientB
    .from("messages")
    .select("*")
    .eq("conversation_id", conv.id);
  check("non-member (B) cannot read its messages", (bMsgs ?? []).length === 0);

  const { error: bSend } = await clientB.from("messages").insert({
    id: crypto.randomUUID(),
    conversation_id: conv.id,
    sender_id: userB.id,
    body: "sneaky",
  });
  check("non-member (B) cannot post into it", !!bSend);

  const { error: bJoin } = await clientB
    .from("conversation_members")
    .insert({ conversation_id: conv.id, user_id: userB.id });
  check("non-member (B) cannot add themself as a member", !!bJoin);

  const { data: aMsgs } = await clientA
    .from("messages")
    .select("*")
    .eq("conversation_id", conv.id);
  check("member (A) can read the messages", (aMsgs ?? []).some((m) => m.id === msgId));
} catch (e) {
  console.error("ERROR:", e.message);
  failures++;
} finally {
  for (const u of createdUsers) {
    await admin.auth.admin.deleteUser(u.id).catch(() => {});
  }
  await admin.from("allowlist").delete().in("email", [emailA, emailB]);
}

console.log(failures === 0 ? "\nRLS check: ALL PASS ✅" : `\nRLS check: ${failures} FAILURE(S) ❌`);
process.exit(failures === 0 ? 0 : 1);
