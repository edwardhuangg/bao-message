// Host tool: reset a friend's forgotten password (no email service involved).
// Run: node scripts/reset-password.mjs friend@example.com "their-new-password"
// Needs SUPABASE_SERVICE_ROLE_KEY in .env.local. Tell them the new password
// out-of-band and have them change it in Profile afterwards.
//
// Note: this resets their SIGN-IN password only. Their encryption backup
// passphrase is separate and cannot be reset by anyone.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const [email, newPassword] = process.argv.slice(2);
if (!email || !newPassword || newPassword.length < 8) {
  console.error('Usage: node scripts/reset-password.mjs <email> <new-password (8+ chars)>');
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

const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) {
  console.error("listUsers failed:", error.message);
  process.exit(1);
}
const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No account found for ${email}`);
  process.exit(1);
}

const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
  password: newPassword,
});
if (updateError) {
  console.error("Reset failed:", updateError.message);
  process.exit(1);
}
console.log(`Password reset for ${email}. Tell them out-of-band; they can change it in Profile.`);
