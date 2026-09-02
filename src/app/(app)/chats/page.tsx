"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { useConversations } from "@/lib/hooks/useConversations";
import { TopBar } from "@/components/TopBar";
import { Avatar } from "@/components/Avatar";
import { ChatListItem } from "@/components/ChatListItem";
import { NewChatSheet } from "@/components/NewChatSheet";
import { BaoLogo } from "@/components/BaoLogo";

export default function ChatsPage() {
  const { userId, profile } = useApp();
  const { entries, reload } = useConversations(userId);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        left={<span className="text-xl font-extrabold tracking-tight">Bao</span>}
        right={
          <Link href="/profile" aria-label="Your profile">
            <Avatar profile={profile} size="sm" />
          </Link>
        }
      />

      <main className="flex-1">
        {entries === null ? null : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-8 pt-24 text-center">
            <BaoLogo size={96} />
            <p className="text-bao-mute">
              No chats yet. Tap <span className="font-semibold">+</span> to
              start one.
            </p>
          </div>
        ) : (
          <ul aria-label="Chats">
            {entries.map((e) => (
              <li key={e.conversation.id}>
                <ChatListItem entry={e} myId={userId} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <button
        onClick={() => setSheetOpen(true)}
        aria-label="New chat"
        className="fixed bottom-6 right-1/2 z-10 flex h-14 w-14 translate-x-[calc(min(50vw,240px)-1.75rem-1rem)] items-center justify-center rounded-full bg-bao-bao text-bao-ink shadow-[0_4px_16px_rgba(43,43,43,0.2)]"
      >
        <Plus size={26} />
      </button>

      {sheetOpen && (
        <NewChatSheet
          myId={userId}
          existing={entries ?? []}
          onClose={() => {
            setSheetOpen(false);
            void reload();
          }}
        />
      )}
    </div>
  );
}
