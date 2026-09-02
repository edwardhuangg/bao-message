import type { Conversation, MemberWithProfile } from "@/lib/supabase/types";

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dateDividerLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

export function sameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// Group consecutive messages from the same sender within 2 minutes.
export function withinGroupWindow(aIso: string, bIso: string) {
  return Math.abs(new Date(aIso).getTime() - new Date(bIso).getTime()) < 2 * 60 * 1000;
}

export function conversationName(
  conversation: Conversation,
  members: MemberWithProfile[],
  myId: string,
) {
  if (conversation.title) return conversation.title;
  const others = members.filter((m) => m.user_id !== myId);
  if (others.length === 0) return "Just you";
  return others.map((m) => m.profiles.display_name).join(", ");
}
