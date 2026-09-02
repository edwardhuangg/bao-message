// Message body encryption with the conversation's symmetric key.

import nacl from "tweetnacl";
import {
  decodeBase64,
  decodeUTF8,
  encodeBase64,
  encodeUTF8,
} from "tweetnacl-util";

export function encryptBody(
  body: string,
  convKey: Uint8Array,
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(decodeUTF8(body), nonce, convKey);
  return { ciphertext: encodeBase64(box), nonce: encodeBase64(nonce) };
}

export function decryptBody(
  ciphertextB64: string,
  nonceB64: string,
  convKey: Uint8Array,
): string | null {
  try {
    const opened = nacl.secretbox.open(
      decodeBase64(ciphertextB64),
      decodeBase64(nonceB64),
      convKey,
    );
    return opened ? encodeUTF8(opened) : null;
  } catch {
    return null;
  }
}
