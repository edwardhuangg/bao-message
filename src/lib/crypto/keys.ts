// Identity keys, conversation-key wrapping, and passphrase backups.
// All crypto runs in the browser; the server only ever sees ciphertext.
// scripts/e2ee-check.mjs mirrors these exact formats — keep them in sync.

import nacl from "tweetnacl";
import { decodeBase64, encodeBase64 } from "tweetnacl-util";
import { idbGet, idbPut } from "./storage";

export type Identity = nacl.BoxKeyPair;

const IDB_SECRET = "identity-secret";

export function generateIdentity(): Identity {
  return nacl.box.keyPair();
}

export async function loadIdentity(): Promise<Identity | null> {
  const secret = await idbGet(IDB_SECRET);
  if (!secret || secret.length !== nacl.box.secretKeyLength) return null;
  return nacl.box.keyPair.fromSecretKey(secret);
}

export async function saveIdentity(identity: Identity): Promise<void> {
  await idbPut(IDB_SECRET, identity.secretKey);
}

export function generateConvKey(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

// Sealed-box style wrap: a fresh ephemeral keypair per wrap, with its public
// key prepended to the box. Unwrapping needs only the recipient's secret key,
// so a wrapper later resetting their identity breaks nothing.
export function wrapConvKey(
  convKey: Uint8Array,
  recipientPublicKeyB64: string,
): { wrapped_key: string; nonce: string } {
  const ephemeral = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const box = nacl.box(
    convKey,
    nonce,
    decodeBase64(recipientPublicKeyB64),
    ephemeral.secretKey,
  );
  const wrapped = new Uint8Array(ephemeral.publicKey.length + box.length);
  wrapped.set(ephemeral.publicKey);
  wrapped.set(box, ephemeral.publicKey.length);
  return { wrapped_key: encodeBase64(wrapped), nonce: encodeBase64(nonce) };
}

export function unwrapConvKey(
  wrappedKeyB64: string,
  nonceB64: string,
  mySecretKey: Uint8Array,
): Uint8Array | null {
  try {
    const wrapped = decodeBase64(wrappedKeyB64);
    const ephemeralPub = wrapped.slice(0, nacl.box.publicKeyLength);
    const box = wrapped.slice(nacl.box.publicKeyLength);
    return nacl.box.open(box, decodeBase64(nonceB64), ephemeralPub, mySecretKey);
  } catch {
    return null;
  }
}

// ---------- Passphrase backup (PBKDF2-SHA256, 600k iterations) ----------

export const PBKDF2_ITERATIONS = 600_000;

async function deriveBackupKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    material,
    256,
  );
  return new Uint8Array(bits);
}

export async function encryptBackup(
  identity: Identity,
  passphrase: string,
): Promise<{ salt: string; nonce: string; ciphertext: string }> {
  const salt = nacl.randomBytes(16);
  const key = await deriveBackupKey(passphrase, salt);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(identity.secretKey, nonce, key);
  return {
    salt: encodeBase64(salt),
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertext),
  };
}

export async function decryptBackup(
  backup: { salt: string; nonce: string; ciphertext: string },
  passphrase: string,
): Promise<Identity | null> {
  try {
    const key = await deriveBackupKey(passphrase, decodeBase64(backup.salt));
    const secret = nacl.secretbox.open(
      decodeBase64(backup.ciphertext),
      decodeBase64(backup.nonce),
      key,
    );
    if (!secret) return null;
    return nacl.box.keyPair.fromSecretKey(secret);
  } catch {
    return null;
  }
}
