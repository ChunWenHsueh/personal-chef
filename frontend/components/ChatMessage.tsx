import clsx from "clsx";
import Image from "next/image";
import { ChefHat, LoaderCircle, UserRound } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Message } from "@/types/chat";

export function ChatMessage({ message }: { message: Message }) {
  const streaming = message.role === "assistant" && message.status === "streaming";
  const failed = message.role === "assistant" && message.status === "error";
  return (
    <article className={clsx("flex w-full gap-3", message.role === "user" ? "justify-end" : "justify-start")} aria-label={message.role === "user" ? "你的訊息" : "助手回覆"}>
      {message.role === "assistant" && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-600 text-white">
          {streaming ? <LoaderCircle size={16} className="animate-spin" /> : <ChefHat size={16} />}
        </span>
      )}
      <div className="min-w-0 max-w-[min(78ch,86%)]">
        <div className={clsx("rounded-lg px-4 py-3 text-sm leading-6", message.role === "user" ? "bg-zinc-900 text-white" : failed ? "border border-red-200 bg-red-50 text-red-900" : "border border-zinc-200 bg-white text-zinc-800")}>
          {message.role === "user" ? (
            <>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              {message.imageUrl && <a href={message.imageUrl} target="_blank" rel="noreferrer" className="mt-3 block"><Image src={message.imageUrl} alt="上傳的食材圖片" width={480} height={320} unoptimized className="max-h-64 w-full rounded-md object-contain" /></a>}
            </>
          ) : streaming && !message.content ? (
            <span className="text-zinc-500" role="status">正在等待回覆…</span>
          ) : (
            <div className="markdown-content break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-blue-700 underline underline-offset-2">{children}</a>,
                table: ({ children }) => <div className="max-w-full overflow-x-auto"><table>{children}</table></div>,
              }}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {message.role === "assistant" && message.status === "stopped" && <p className="mt-1 text-xs text-zinc-500">已停止生成</p>}
      </div>
      {message.role === "user" && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-200 text-zinc-700"><UserRound size={16} /></span>}
    </article>
  );
}
