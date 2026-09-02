"use client";

import { useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";

export function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const hasText = text.trim().length > 0;

  function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    if (ref.current) ref.current.style.height = "auto";
    ref.current?.focus();
  }

  function autosize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    // ~5 lines max, then scroll inside the field
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <div className="sticky bottom-0 flex shrink-0 items-end gap-2 border-t border-bao-steam bg-bao-cream px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
      <textarea
        ref={ref}
        value={text}
        rows={1}
        placeholder="Message"
        aria-label="Message"
        enterKeyHint="enter"
        className="max-h-[120px] flex-1 resize-none rounded-3xl border border-bao-steam bg-white px-4 py-2.5 text-[15px] leading-snug outline-none placeholder:text-bao-mute focus:border-bao-bao"
        onChange={(e) => {
          setText(e.target.value);
          autosize(e.target);
        }}
        onKeyDown={(e) => {
          // Desktop: Enter sends, Shift+Enter is a newline.
          // Touch devices: Enter is always a newline (per DESIGN.md).
          const touch = window.matchMedia("(pointer: coarse)").matches;
          if (e.key === "Enter" && !e.shiftKey && !touch) {
            e.preventDefault();
            send();
          }
        }}
      />
      <button
        type="button"
        onClick={send}
        disabled={!hasText}
        aria-label="Send"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-120 ${
          hasText ? "bg-bao-bao text-bao-ink" : "bg-bao-steam text-bao-mute"
        }`}
      >
        <SendHorizonal size={20} />
      </button>
    </div>
  );
}
