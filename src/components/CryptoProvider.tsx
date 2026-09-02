"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { encodeBase64 } from "tweetnacl-util";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { BaoLogo } from "@/components/BaoLogo";
import {
  decryptBackup,
  encryptBackup,
  generateConvKey,
  generateIdentity,
  loadIdentity,
  saveIdentity,
  unwrapConvKey,
  wrapConvKey,
  type Identity,
} from "@/lib/crypto/keys";
import type { Profile } from "@/lib/supabase/types";

type CryptoStatus = "loading" | "setup" | "restore" | "ready";

interface WrappedKeyRow {
  conversation_id: string;
  key_version: number;
  wrapped_key: string;
  nonce: string;
}

interface CryptoContextValue {
  status: CryptoStatus;
  /** All conversation-key versions this device can unwrap, keyed by version. */
  getConvKeys: (conversationId: string) => Promise<Map<number, Uint8Array>>;
  /** Highest unwrappable key for sending, or null when locked out. */
  currentKey: (
    conversationId: string,
  ) => Promise<{ key: Uint8Array; version: number } | null>;
  /** Creates v1 of a conversation's key, wrapped for self + given members. */
  createConvKey: (
    conversationId: string,
    others: Pick<Profile, "id" | "public_key">[],
  ) => Promise<void>;
  /** Wraps a fresh key version for every current member's current identity. */
  rotateConvKey: (
    conversationId: string,
    opts?: { excludeUserId?: string },
  ) => Promise<boolean>;
  /** Drops the cache so the next getConvKeys refetches (e.g. while polling). */
  invalidate: (conversationId: string) => void;
  updateBackupPassphrase: (passphrase: string) => Promise<string | null>;
}

const CryptoContext = createContext<CryptoContextValue | null>(null);

export function useCrypto() {
  const ctx = useContext(CryptoContext);
  if (!ctx) throw new Error("useCrypto must be used inside CryptoProvider");
  return ctx;
}

export function CryptoProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const { userId, profile, setProfile } = useApp();
  const [status, setStatus] = useState<CryptoStatus>("loading");
  const identityRef = useRef<Identity | null>(null);
  const keyCacheRef = useRef<Map<string, Map<number, Uint8Array>>>(new Map());

  const uploadPublicKey = useCallback(
    async (identity: Identity) => {
      const public_key = encodeBase64(identity.publicKey);
      const { error } = await supabase
        .from("profiles")
        .update({ public_key })
        .eq("id", userId);
      if (!error) setProfile({ ...profile, public_key });
      return !error;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- profile only feeds setProfile's copy
    [supabase, userId, setProfile, profile.public_key],
  );

  // Bootstrap: figure out which of the four device states we're in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Fresh read — the context profile may predate a reset on another device.
      const { data } = await supabase
        .from("profiles")
        .select("public_key")
        .eq("id", userId)
        .maybeSingle();
      const serverPub = data?.public_key ?? null;
      const identity = await loadIdentity().catch(() => null);
      if (cancelled) return;

      if (identity) {
        const localPub = encodeBase64(identity.publicKey);
        if (!serverPub) {
          identityRef.current = identity;
          await uploadPublicKey(identity);
          setStatus("ready");
        } else if (serverPub === localPub) {
          identityRef.current = identity;
          setStatus("ready");
        } else {
          // Identity was reset/restored differently on another device.
          setStatus("restore");
        }
      } else if (serverPub) {
        setStatus("restore");
      } else {
        setStatus("setup");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount
  }, [supabase, userId]);

  const finishSetup = useCallback(
    async (passphrase: string): Promise<string | null> => {
      const identity = generateIdentity();
      const backup = await encryptBackup(identity, passphrase);
      const { error: backupError } = await supabase
        .from("key_backups")
        .upsert({ user_id: userId, ...backup });
      if (backupError) return backupError.message;
      await saveIdentity(identity);
      identityRef.current = identity;
      const ok = await uploadPublicKey(identity);
      if (!ok) return "Could not publish your public key — try again.";
      keyCacheRef.current.clear();
      setStatus("ready");
      return null;
    },
    [supabase, userId, uploadPublicKey],
  );

  const finishRestore = useCallback(
    async (passphrase: string): Promise<string | null> => {
      const { data: backup } = await supabase
        .from("key_backups")
        .select("salt, nonce, ciphertext")
        .eq("user_id", userId)
        .maybeSingle();
      if (!backup)
        return "No key backup exists for your account. You'll need to reset instead.";
      const identity = await decryptBackup(backup, passphrase);
      if (!identity) return "That passphrase didn't unlock your backup.";
      await saveIdentity(identity);
      identityRef.current = identity;
      // Heal the published key if it drifted from the backup.
      const pub = encodeBase64(identity.publicKey);
      const { data } = await supabase
        .from("profiles")
        .select("public_key")
        .eq("id", userId)
        .maybeSingle();
      if (data?.public_key !== pub) await uploadPublicKey(identity);
      keyCacheRef.current.clear();
      setStatus("ready");
      return null;
    },
    [supabase, userId, uploadPublicKey],
  );

  const getConvKeys = useCallback(
    async (conversationId: string) => {
      const cached = keyCacheRef.current.get(conversationId);
      if (cached) return cached;
      const keys = new Map<number, Uint8Array>();
      const identity = identityRef.current;
      if (!identity) return keys;
      // RLS restricts this to rows wrapped for me.
      const { data } = await supabase
        .from("conversation_keys")
        .select("conversation_id, key_version, wrapped_key, nonce")
        .eq("conversation_id", conversationId);
      for (const row of (data as WrappedKeyRow[]) ?? []) {
        const key = unwrapConvKey(row.wrapped_key, row.nonce, identity.secretKey);
        if (key) keys.set(row.key_version, key);
      }
      keyCacheRef.current.set(conversationId, keys);
      return keys;
    },
    [supabase],
  );

  const currentKey = useCallback(
    async (conversationId: string) => {
      const keys = await getConvKeys(conversationId);
      let best: { key: Uint8Array; version: number } | null = null;
      for (const [version, key] of keys) {
        if (!best || version > best.version) best = { key, version };
      }
      return best;
    },
    [getConvKeys],
  );

  const insertWrapped = useCallback(
    async (
      conversationId: string,
      convKey: Uint8Array,
      version: number,
      recipients: { id: string; public_key: string }[],
    ) => {
      const rows = recipients.map((r) => ({
        conversation_id: conversationId,
        user_id: r.id,
        key_version: version,
        ...wrapConvKey(convKey, r.public_key),
        wrapped_by: userId,
      }));
      const { error } = await supabase.from("conversation_keys").insert(rows);
      return !error;
    },
    [supabase, userId],
  );

  const createConvKey = useCallback(
    async (
      conversationId: string,
      others: Pick<Profile, "id" | "public_key">[],
    ) => {
      const identity = identityRef.current;
      if (!identity) return;
      const convKey = generateConvKey();
      const recipients = [
        { id: userId, public_key: encodeBase64(identity.publicKey) },
        ...others.flatMap((m) =>
          m.public_key ? [{ id: m.id, public_key: m.public_key }] : [],
        ),
      ];
      if (await insertWrapped(conversationId, convKey, 1, recipients)) {
        keyCacheRef.current.set(conversationId, new Map([[1, convKey]]));
      }
    },
    [userId, insertWrapped],
  );

  const rotateConvKey = useCallback(
    async (conversationId: string, opts?: { excludeUserId?: string }) => {
      const identity = identityRef.current;
      if (!identity) return false;
      keyCacheRef.current.delete(conversationId);
      const keys = await getConvKeys(conversationId);
      if (keys.size === 0) return false; // can't rotate a chat I'm locked out of
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id, profiles(public_key)")
        .eq("conversation_id", conversationId);
      const recipients = ((members as unknown as {
        user_id: string;
        profiles: { public_key: string | null };
      }[]) ?? [])
        .filter(
          (m) => m.user_id !== opts?.excludeUserId && m.profiles?.public_key,
        )
        .map((m) => ({ id: m.user_id, public_key: m.profiles.public_key! }));
      if (recipients.length === 0) return false;
      const version = Math.max(...keys.keys()) + 1;
      const convKey = generateConvKey();
      const ok = await insertWrapped(conversationId, convKey, version, recipients);
      if (ok) {
        const mine = keyCacheRef.current.get(conversationId) ?? new Map();
        mine.set(version, convKey);
        keyCacheRef.current.set(conversationId, mine);
      }
      return ok;
    },
    [supabase, getConvKeys, insertWrapped],
  );

  const invalidate = useCallback((conversationId: string) => {
    keyCacheRef.current.delete(conversationId);
  }, []);

  const updateBackupPassphrase = useCallback(
    async (passphrase: string) => {
      const identity = identityRef.current;
      if (!identity) return "Encryption isn't set up on this device yet.";
      const backup = await encryptBackup(identity, passphrase);
      const { error } = await supabase
        .from("key_backups")
        .upsert({ user_id: userId, ...backup });
      return error ? error.message : null;
    },
    [supabase, userId],
  );

  const value = useMemo(
    () => ({
      status,
      getConvKeys,
      currentKey,
      createConvKey,
      rotateConvKey,
      invalidate,
      updateBackupPassphrase,
    }),
    [
      status,
      getConvKeys,
      currentKey,
      createConvKey,
      rotateConvKey,
      invalidate,
      updateBackupPassphrase,
    ],
  );

  return (
    <CryptoContext.Provider value={value}>
      {children}
      {(status === "setup" || status === "restore") && (
        <KeyGate
          mode={status}
          onSetup={finishSetup}
          onRestore={finishRestore}
        />
      )}
    </CryptoContext.Provider>
  );
}

// Blocking overlay for first-time key setup / new-device restore / reset.
function KeyGate({
  mode,
  onSetup,
  onRestore,
}: {
  mode: "setup" | "restore";
  onSetup: (passphrase: string) => Promise<string | null>;
  onRestore: (passphrase: string) => Promise<string | null>;
}) {
  const [view, setView] = useState<"setup" | "restore" | "reset">(mode);
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (view === "restore") {
      if (!pass) return;
      setBusy(true);
      const err = await onRestore(pass);
      setBusy(false);
      if (err) setError(err);
      return;
    }
    // setup and reset both mint a fresh identity + backup
    if (pass.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (pass !== confirm) {
      setError("The passphrases don't match.");
      return;
    }
    setBusy(true);
    const err = await onSetup(pass);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-bao-ink/40 p-6">
      <form
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-[14px] bg-bao-cream p-6 shadow-xl"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <BaoLogo size={56} />
          <h2 className="text-lg font-bold">
            {view === "setup" && "Set up encryption"}
            {view === "restore" && "Unlock your messages"}
            {view === "reset" && "Reset encryption"}
          </h2>
          <p className="text-sm text-bao-mute">
            {view === "setup" &&
              "Bao encrypts messages on your device. Choose a backup passphrase so a new phone can read your history."}
            {view === "restore" &&
              "This device doesn't have your encryption key yet. Enter your backup passphrase to restore it."}
            {view === "reset" &&
              "This creates a brand-new key. Old messages will stay locked forever, and friends' apps will re-share chat keys with you for new messages."}
          </p>
        </div>

        <input
          type="password"
          autoComplete={view === "restore" ? "current-password" : "new-password"}
          placeholder={view === "restore" ? "Backup passphrase" : "New backup passphrase"}
          aria-label="Backup passphrase"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          className="h-12 rounded-full border border-bao-steam bg-white px-5 text-[15px] outline-none focus:border-bao-bao"
        />
        {view !== "restore" && (
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Repeat passphrase"
            aria-label="Repeat passphrase"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-12 rounded-full border border-bao-steam bg-white px-5 text-[15px] outline-none focus:border-bao-bao"
          />
        )}

        <button
          type="submit"
          disabled={busy}
          className="h-12 rounded-full bg-bao-bao text-[15px] font-semibold text-bao-ink disabled:opacity-60"
        >
          {busy
            ? "Working…"
            : view === "restore"
              ? "Unlock"
              : view === "reset"
                ? "Reset & create new key"
                : "Turn on encryption"}
        </button>
        {error && (
          <p role="alert" className="text-center text-sm text-bao-danger">
            {error}
          </p>
        )}
        {view === "setup" && (
          <p className="text-center text-xs text-bao-mute">
            If you lose your devices and forget this passphrase, your message
            history is gone — nobody can recover it, not even us.
          </p>
        )}
        {view === "restore" && (
          <button
            type="button"
            onClick={() => {
              setView("reset");
              setPass("");
              setConfirm("");
              setError(null);
            }}
            className="text-sm text-bao-mute underline"
          >
            I forgot my passphrase
          </button>
        )}
        {view === "reset" && (
          <button
            type="button"
            onClick={() => {
              setView("restore");
              setPass("");
              setConfirm("");
              setError(null);
            }}
            className="text-sm text-bao-mute underline"
          >
            Back — try my passphrase again
          </button>
        )}
      </form>
    </div>
  );
}
