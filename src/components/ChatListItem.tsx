"use client";

import Link from "next/link";
import type { ChatListEntry } from "@/lib/supabase/types";
import { Avatar } from "@/components/Avatar";
import { conversationName, formatTime, sameDay } from "@/lib/format";

export function ChatListItem({
  entry,
  myId,
}: {
  entry: ChatListEntry;
  myId: string;
}) {
  const { conversation, members, lastMessage, myLastReadAt } = entry;
  const others = members.filter((m) => m.user_id !== myId);
  const face = (others[0] ?? members[0])?.profiles;
  const name = conversationName(conversation, members, myId);

  const unread =
    !!lastMessage &&
    lastMessage.sender_id !== myId &&
    (!myLastReadAt || myLastReadAt < lastMessage.created_at);

  const when = lastMessage
    ? sameDay(lastMessage.created_at, new Date().toISOString())
      ? formatTime(lastMessage.created_at)
      : new Date(lastMessage.created_at).toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })
    : "";

  return (
    <Link
      href={`/chats/${conversation.id}`}
      className="flex min-h-[68px] items-center gap-3 px-4 py-2.5 active:bg-bao-steam/60"
    >
      {face && <Avatar profile={face} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
          <span className="shrink-0 text-[12px] text-bao-mute">{when}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm text-bao-mute">
            {lastMessage?.body ?? "Say hi 👋"}
          </span>
          {unread && (
            <span
              aria-label="Unread messages"
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-bao-leaf"
            />
          )}
        </div>
      </div>
    </Link>
  );
}
