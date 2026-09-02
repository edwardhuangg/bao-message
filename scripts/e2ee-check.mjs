// Phase 2 E2EE verification (SECURITY.md checklist), run against the live
// project with throwaway users. Mirrors the exact wire formats in
// src/lib/crypto/{keys,box}.ts — keep them in sync.
//
// Run: node scripts/e2ee-check.mjs  (needs SUPABASE_SERVICE_ROLE_KEY in .env.local)

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

const { decodeBase64, encodeBase64, decodeUTF8, encodeUTF8 } = naclUtil;

// ---- same formats as src/lib/crypto ----
function wrapConvKey(convKey, recipientPubB64) {
  const eph = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const box = nacl.box(convKey, nonce, decodeBase64(recipientPubB64), eph.secretKey);
  const wrapped = new Uint8Array(eph.publicKey.length + box.length);
  wrapped.set(eph.publicKey);
  wrapped.set(box, eph.publicKey.length);
  return { wrapped_key: encodeBase64(wrapped), nonce: encodeBase64(nonce) };
}
function unwrapConvKey(wrappedB64, nonceB64, mySecret) {
  const wrapped = decodeBase64(wrappedB64);
  return nacl.box.open(
    wrapped.slice(nacl.box.publicKeyLength),
    decodeBase64(nonceB64),
    wrapped.slice(0, nacl.box.publicKeyLength),
    mySecret,
  );
}
function encryptBody(body, convKey) {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  return {
    ciphertext: encodeBase64(nacl.secretbox(decodeUTF8(body), nonce, convKey)),
    nonce: encodeBase64(nonce),
  };
}
function decryptBody(ciphertextB64, nonceB64, convKey) {
  const opened = nacl.secretbox.open(decodeBase64(ciphertextB64), decodeBase64(nonceB64), convKey);
  return opened ? encodeUTF8(opened) : null;
}
async function deriveBackupKey(passphrase, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 600_000 }, material, 256));
}
// ----------------------------------------

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const suffix = Math.random().toString(36).slice(2, 8);
const emails = [`e2ee-a-${suffix}@example.com`, `e2ee-b-${suffix}@example.com`];
const password = `E2ee-${suffix}!x`;

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const users = [];
try {
  await admin.from("allowlist").insert(emails.map((email) => ({ email, note: "e2ee (temp)" })));
  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`createUser: ${error.message}`);
    users.push(data.user);
  }
  const [userA, userB] = users;
  const clientA = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const clientB = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await clientA.auth.signInWithPassword({ email: emails[0], password });
  await clientB.auth.signInWithPassword({ email: emails[1], password });

  // Device identities, public halves published like CryptoProvider does.
  const idA = nacl.box.keyPair();
  const idB = nacl.box.keyPair();
  await clientA.from("profiles").insert({ id: userA.id, display_name: "E2EE A", public_key: encodeBase64(idA.publicKey) });
  await clientB.from("profiles").insert({ id: userB.id, display_name: "E2EE B", public_key: encodeBase64(idB.publicKey) });

  // A creates an encrypted conversation with B.
  const convId = crypto.randomUUID();
  await clientA.from("conversations").insert({ id: convId, created_by: userA.id });
  await clientA.from("conversation_members").insert({ conversation_id: convId, user_id: userA.id });
  await clientA.from("conversation_members").insert({ conversation_id: convId, user_id: userB.id });
  const convKey = nacl.randomBytes(32);
  const { error: wrapErr } = await clientA.from("conversation_keys").insert([
    { conversation_id: convId, user_id: userA.id, key_version: 1, ...wrapConvKey(convKey, encodeBase64(idA.publicKey)), wrapped_by: userA.id },
    { conversation_id: convId, user_id: userB.id, key_version: 1, ...wrapConvKey(convKey, encodeBase64(idB.publicKey)), wrapped_by: userA.id },
  ]);
  check("A wraps the conversation key for both members", !wrapErr, wrapErr?.message);

  // A sends an encrypted message.
  const secret = `the secret bao filling is taro ${suffix}`;
  const msgId = crypto.randomUUID();
  const enc = encryptBody(secret, convKey);
  const { error: sendErr } = await clientA.from("messages").insert({ id: msgId, conversation_id: convId, sender_id: userA.id, ciphertext: enc.ciphertext, nonce: enc.nonce, key_version: 1 });
  check("A sends an encrypted message", !sendErr, sendErr?.message);

  // Checklist: the server-side row holds no readable plaintext.
  const { data: rawRows } = await admin.from("messages").select("body, ciphertext, nonce").eq("id", msgId);
  const raw = rawRows?.[0];
  check("DB row has body = null (no plaintext column data)", raw && raw.body === null);
  check("DB ciphertext does not contain the plaintext", raw && !String(raw.ciphertext).includes("taro") && !String(raw.nonce).includes("taro"));

  // B unwraps their key row and decrypts.
  const { data: bKeyRows } = await clientB.from("conversation_keys").select("*").eq("conversation_id", convId);
  check("B sees only their own wrapped-key rows (RLS)", (bKeyRows ?? []).every((r) => r.user_id === userB.id) && (bKeyRows ?? []).length === 1);
  const bConvKey = unwrapConvKey(bKeyRows[0].wrapped_key, bKeyRows[0].nonce, idB.secretKey);
  check("B unwraps the conversation key", !!bConvKey);
  const { data: bMsgs } = await clientB.from("messages").select("*").eq("conversation_id", convId);
  const decrypted = bConvKey && bMsgs?.length ? decryptBody(bMsgs[0].ciphertext, bMsgs[0].nonce, bConvKey) : null;
  check("B decrypts A's message to the exact plaintext", decrypted === secret);

  // Rotation excluding B ~ removed member cannot read post-rotation messages.
  const convKey2 = nacl.randomBytes(32);
  await clientA.from("conversation_keys").insert([
    { conversation_id: convId, user_id: userA.id, key_version: 2, ...wrapConvKey(convKey2, encodeBase64(idA.publicKey)), wrapped_by: userA.id },
  ]);
  const enc2 = encryptBody(`post-rotation secret ${suffix}`, convKey2);
  const msg2Id = crypto.randomUUID();
  await clientA.from("messages").insert({ id: msg2Id, conversation_id: convId, sender_id: userA.id, ciphertext: enc2.ciphertext, nonce: enc2.nonce, key_version: 2 });
  const { data: bKeys2 } = await clientB.from("conversation_keys").select("*").eq("conversation_id", convId).eq("key_version", 2);
  const { data: bMsg2 } = await clientB.from("messages").select("*").eq("id", msg2Id);
  const bCanRead2 = (bKeys2 ?? []).length > 0 || (bMsg2?.[0] && bConvKey && decryptBody(bMsg2[0].ciphertext, bMsg2[0].nonce, bConvKey) !== null);
  check("excluded member cannot decrypt post-rotation messages", !bCanRead2);
  const { data: aKeys2 } = await clientA.from("conversation_keys").select("*").eq("conversation_id", convId).eq("key_version", 2);
  const aConvKey2 = unwrapConvKey(aKeys2[0].wrapped_key, aKeys2[0].nonce, idA.secretKey);
  check("remaining member decrypts post-rotation messages", aConvKey2 && decryptBody(bMsg2 ? enc2.ciphertext : enc2.ciphertext, enc2.nonce, aConvKey2) === `post-rotation secret ${suffix}`);

  // Passphrase backup round-trip (new-device restore).
  const passphrase = `correct horse bao staple ${suffix}`;
  const salt = nacl.randomBytes(16);
  const bkey = await deriveBackupKey(passphrase, salt);
  const bnonce = nacl.randomBytes(24);
  const backupCt = nacl.secretbox(idA.secretKey, bnonce, bkey);
  const { error: bkErr } = await clientA.from("key_backups").upsert({ user_id: userA.id, salt: encodeBase64(salt), nonce: encodeBase64(bnonce), ciphertext: encodeBase64(backupCt) });
  check("A stores a passphrase-encrypted key backup", !bkErr, bkErr?.message);
  const { data: fetched } = await clientA.from("key_backups").select("*").eq("user_id", userA.id).single();
  const restoredSecret = nacl.secretbox.open(decodeBase64(fetched.ciphertext), decodeBase64(fetched.nonce), await deriveBackupKey(passphrase, decodeBase64(fetched.salt)));
  const restoredId = restoredSecret && nacl.box.keyPair.fromSecretKey(restoredSecret);
  const restoredConvKey = restoredId && unwrapConvKey(aKeys2[0].wrapped_key, aKeys2[0].nonce, restoredId.secretKey);
  check("'new device' restores from backup and reads history", restoredConvKey && decryptBody(enc2.ciphertext, enc2.nonce, restoredConvKey) === `post-rotation secret ${suffix}`);
  const wrongKey = await deriveBackupKey("wrong passphrase", decodeBase64(fetched.salt));
  check("wrong passphrase fails to open the backup", nacl.secretbox.open(decodeBase64(fetched.ciphertext), decodeBase64(fetched.nonce), wrongKey) === null);

  // Checklist: private keys never reach the server.
  const secretsB64 = [encodeBase64(idA.secretKey), encodeBase64(idB.secretKey)];
  const { data: allProfiles } = await admin.from("profiles").select("*").in("id", [userA.id, userB.id]);
  const { data: allKeys } = await admin.from("conversation_keys").select("*").eq("conversation_id", convId);
  const blob = JSON.stringify(allProfiles) + JSON.stringify(allKeys) + JSON.stringify(rawRows);
  check("identity secret keys appear nowhere server-side", !secretsB64.some((s) => blob.includes(s)));
} catch (e) {
  console.error("ERROR:", e.message);
  failures++;
} finally {
  for (const u of users) await admin.auth.admin.deleteUser(u.id).catch(() => {});
  await admin.from("allowlist").delete().in("email", emails);
}

console.log(failures === 0 ? "\nE2EE check: ALL PASS ✅" : `\nE2EE check: ${failures} FAILURE(S) ❌`);
process.exit(failures === 0 ? 0 : 1);
