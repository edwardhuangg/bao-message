"use client";

import { RotateCw } from "lucide-react";
import type { LocalMessage } from "@/lib/supabase/types";
import { formatTime } from "@/lib/format";

export function Bubble({
  message,
  mine,
  firstInRun,
  onRetry,
}: {
  message: LocalMessage;
  mine: boolean;
  firstInRun: boolean;
  onRetry?: (m: LocalMessage) => void;
}) {
  const pending = message.sendState === "pending";
  const failed = message.sendState === "failed";

  return (
    <div
      className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""} ${
        firstInRun ? "mt-2" : "mt-0.5"
      }`}
    >
      <div
        className={`max-w-[75%] whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-[15px] leading-snug motion-safe:animate-[bubble-in_120ms_ease-out] ${
          mine ? "bg-bao-bao text-bao-ink" : "bg-bao-steam text-bao-ink"
        } ${pending ? "opacity-70" : ""}`}
      >
        {message.body}
      </div>
      {failed ? (
        <button
          type="button"
          onClick={() => onRetry?.(message)}
          aria-label="Message failed to send — tap to retry"
          className="flex h-11 min-w-11 items-center justify-center gap-1 text-bao-danger"
        >
          <span className="text-sm font-bold">!</span>
          <RotateCw size={14} />
        </button>
      ) : (
        <span className="mb-0.5 shrink-0 text-[12px] text-bao-mute">
          {formatTime(message.created_at)}
        </span>
      )}
    </div>
  );
}
