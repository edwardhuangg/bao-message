// Host tool: create a friend's account directly — allowlists the email,
// creates the user pre-confirmed, and sets a temporary password. Works even
// with "Confirm email" enabled, because no email is ever involved.
//
// Run: node scripts/create-user.mjs friend@example.com "temp-password"
// Tell them the password out-of-band; they change it in Profile after first
// sign-in.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage: node scripts/create-user.mjs <email> <temp-password (8+ chars)>');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is missing from .env.local");
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { error: allowErr } = await admin
  .from("allowlist")
  .upsert({ email: email.toLowerCase(), note: "added via create-user script" });
if (allowErr) {
  console.error("allowlist insert failed:", allowErr.message);
  process.exit(1);
}

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error) {
  if (/already.*registered|already.*exists/i.test(error.message)) {
    console.error(`${email} already has an account. To reset their password instead:`);
    console.error(`  node scripts/reset-password.mjs ${email} "<new-password>"`);
  } else {
    console.error("createUser failed:", error.message);
  }
  process.exit(1);
}

console.log(`Account ready for ${email} (id ${data.user.id}).`);
console.log("Tell them the temp password out-of-band. First sign-in walks them through");
console.log("display name + avatar and the encryption passphrase; they can change the");
console.log("password in Profile.");
