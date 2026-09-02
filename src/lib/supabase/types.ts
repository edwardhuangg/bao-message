// Hand-written row types for Phase 1. Replace with generated types once the
// Supabase CLI is set up: supabase gen types typescript --project-id <id>

export interface Profile {
  id: string;
  display_name: string;
  avatar_color: string;
  avatar_emoji: string | null;
  public_key: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  is_group: boolean;
  created_by: string;
  key_version: number;
  created_at: string;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  ciphertext: string | null;
  nonce: string | null;
  key_version: number;
  created_at: string;
}

export type SendState = "pending" | "sent" | "failed";

// Message as held in client state; sendState is undefined for confirmed rows.
// body holds decrypted plaintext (memory only — never persisted).
export interface LocalMessage extends Message {
  sendState?: SendState;
  decryptFailed?: boolean;
}

// Plaintext control messages the clients exchange to coordinate key rotation.
// They are filtered out of the UI and previews.
export const CONTROL_PREFIX = "__bao:";
export const CTRL_KEY_REQUEST = "__bao:key_request";
export const CTRL_LEFT = "__bao:left";

export interface MemberWithProfile extends ConversationMember {
  profiles: Profile;
}

export interface ChatListEntry {
  conversation: Conversation;
  members: MemberWithProfile[];
  lastMessage: Message | null;
  myLastReadAt: string | null;
}
