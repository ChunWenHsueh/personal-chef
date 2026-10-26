"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import Image from "next/image";
import { ImagePlus, Send, Square, X } from "lucide-react";
import { imageValidationError } from "@/lib/api";

interface ChatInputProps {
  onSend: (text: string, file?: File) => Promise<boolean>;
  disabled: boolean;
  onStop?: () => void;
}

export function ChatInput({ onSend, disabled, onStop }: ChatInputProps) {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<{ file: File; previewUrl: string } | null>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!attachment) return;
    return () => URL.revokeObjectURL(attachment.previewUrl);
  }, [attachment]);

  useEffect(() => {
    if (!textArea.current) return;
    textArea.current.style.height = "auto";
    textArea.current.style.height = Math.min(textArea.current.scrollHeight, 144) + "px";
  }, [text]);

  useEffect(() => {
    if (!disabled) textArea.current?.focus();
  }, [disabled]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || (!text.trim() && !attachment)) return;
    const sent = await onSend(text.trim() || "請根據圖片中的食材推薦食譜。", attachment?.file);
    if (sent) {
      setText("");
      setAttachment(null);
      setError("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mx-auto w-full max-w-4xl bg-white px-4 py-3 sm:px-6">
      {attachment && (
        <div className="mb-3 flex items-center gap-3">
          <div className="relative shrink-0">
            <Image src={attachment.previewUrl} alt="待上傳的食材圖片" width={96} height={80} unoptimized className="h-20 w-24 rounded-md border border-zinc-200 object-cover" />
            <button type="button" disabled={disabled} onClick={() => {
              setAttachment(null);
              if (fileInput.current) fileInput.current.value = "";
            }} className="absolute -right-2 -top-2 rounded-full bg-zinc-900 p-1 text-white disabled:opacity-40" aria-label="移除圖片"><X size={15} /></button>
          </div>
          <p className="min-w-0 truncate text-xs text-zinc-500">{attachment.file.name}</p>
        </div>
      )}
      {error && <p role="alert" className="mb-2 text-xs text-red-700">{error}</p>}
      <div className="flex items-end gap-2">
        <button type="button" onClick={() => fileInput.current?.click()} disabled={disabled} aria-label="選擇食材圖片" title="選擇食材圖片" className="icon-button h-10 w-10">
          <ImagePlus size={19} />
        </button>
        <input
          ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
          aria-label="食材圖片檔案" className="hidden" disabled={disabled}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (!selected) return;
            const validationError = imageValidationError(selected);
            setError(validationError || "");
            if (validationError) { event.target.value = ""; return; }
            setAttachment({ file: selected, previewUrl: URL.createObjectURL(selected) });
          }}
        />
        <textarea
          ref={textArea} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={keyDown}
          aria-label="訊息" placeholder="輸入現有食材或想吃的菜…" maxLength={4000} rows={1} disabled={disabled}
          className="min-h-10 max-h-36 flex-1 resize-none rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-zinc-100"
        />
        {onStop ? (
          <button type="button" onClick={onStop} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-white hover:bg-zinc-700" aria-label="停止生成" title="停止生成"><Square size={15} fill="currentColor" /></button>
        ) : (
          <button type="submit" disabled={disabled || (!text.trim() && !attachment)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-zinc-300" aria-label="傳送" title="傳送"><Send size={18} /></button>
        )}
      </div>
      <p className="mt-2 pl-12 text-xs text-zinc-400">可附上 10 MB 以內的圖片。Enter 傳送，Shift + Enter 換行</p>
    </form>
  );
}
