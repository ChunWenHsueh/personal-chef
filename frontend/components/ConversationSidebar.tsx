import clsx from "clsx";
import { ChefHat, LoaderCircle, MessageSquareText, Plus, RefreshCw, X } from "lucide-react";
import type { ConversationThread } from "@/types/chat";

interface ConversationSidebarProps {
  threads: ConversationThread[];
  currentThreadId: string | null;
  open: boolean;
  busy: boolean;
  loading: boolean;
  error: string;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

export function ConversationSidebar(props: ConversationSidebarProps) {
  return (
    <>
      {props.open && <button className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={props.onClose} aria-label="關閉對話列表" />}
      <aside className={clsx(
        "fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col bg-zinc-950 text-zinc-100 transition-transform lg:relative lg:z-0 lg:translate-x-0",
        props.open ? "visible translate-x-0" : "invisible -translate-x-full lg:visible",
      )} aria-label="對話側欄">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-800 px-4">
          <ChefHat size={24} className="text-orange-500" />
          <span className="flex-1 text-sm font-semibold">AI 私人廚師</span>
          <button onClick={props.onClose} className="icon-button-dark lg:hidden" aria-label="收起對話列表"><X size={18} /></button>
        </div>
        <div className="p-3">
          <button onClick={props.onNew} disabled={props.busy} className="primary-button w-full">
            <Plus size={17} />新對話
          </button>
        </div>
        <div className="flex items-center justify-between px-4 pb-2 text-xs text-zinc-400">
          <span>過去的對話</span>
          <button onClick={props.onRefresh} disabled={props.loading || props.busy} className="icon-button-dark" aria-label="重新整理對話列表">
            {props.loading ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
        {props.error && <p className="px-4 pb-3 text-xs text-red-300" role="alert">{props.error}</p>}
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="過去的對話">
          {props.threads.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-zinc-500">{props.loading ? "正在讀取對話…" : "還沒有對話，傳送訊息後會出現在這裡。"}</p>
          ) : (
            <ul className="space-y-1">
              {props.threads.map((thread) => (
                <li key={thread.thread_id}>
                  <button
                    onClick={() => props.onSelect(thread.thread_id)} disabled={props.busy}
                    aria-current={props.currentThreadId === thread.thread_id ? "page" : undefined}
                    className={clsx("flex w-full items-start gap-2 rounded-md px-3 py-3 text-left disabled:opacity-50", props.currentThreadId === thread.thread_id ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-900")}
                  >
                    <MessageSquareText size={16} className="mt-0.5 shrink-0 text-zinc-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{thread.title}</span>
                      <span className="mt-1 block truncate text-xs text-zinc-500">{thread.last_message}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>
    </>
  );
}
