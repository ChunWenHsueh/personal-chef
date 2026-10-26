"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { EmptyState } from "@/components/EmptyState";
import { clearChatHistory, getChatHistory, getConversationThreads, streamChat, uploadImage } from "@/lib/api";
import type { ConversationThread, Message } from "@/types/chat";

type Activity =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "uploading" }
  | { kind: "streaming" }
  | { kind: "clearing" }
  | { kind: "history_error"; message: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [activity, setActivity] = useState<Activity>({ kind: "loading" });
  const [operationError, setOperationError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [composerRevision, setComposerRevision] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const listRequest = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const refreshThreads = useCallback(async () => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setListLoading(true);
    setListError("");
    try {
      const items = await getConversationThreads(controller.signal);
      if (!controller.signal.aborted) setThreads(items);
    } catch (error) {
      if (!controller.signal.aborted) setListError(error instanceof Error ? error.message : "讀取對話列表失敗。");
    } finally {
      if (!controller.signal.aborted) setListLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (id: string | null) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setSelectedId(id);
    setMessages([]);
    setComposerRevision((current) => current + 1);
    setActivity({ kind: "loading" });
    setOperationError("");
    setConfirmClear(false);
    setSidebarOpen(false);
    try {
      if (id) {
        const history = await getChatHistory(id, controller.signal);
        if (controller.signal.aborted) return;
        if (history.length) {
          localStorage.setItem("thread_id", id);
          setMessages(history);
        } else {
          localStorage.removeItem("thread_id");
          setSelectedId(null);
        }
      } else {
        localStorage.removeItem("thread_id");
      }
      setActivity({ kind: "ready" });
    } catch (error) {
      if (controller.signal.aborted) return;
      setActivity({ kind: "history_error", message: error instanceof Error ? error.message : "讀取聊天歷史失敗。" });
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      void refreshThreads();
      try {
        await loadConversation(localStorage.getItem("thread_id"));
      } catch {
        setActivity({ kind: "history_error", message: "無法讀取瀏覽器中的對話設定。" });
      }
    }
    void initialize();
    return () => { activeRequest.current?.abort(); listRequest.current?.abort(); };
  }, [loadConversation, refreshThreads]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function sendMessage(text: string, file?: File): Promise<boolean> {
    if (sending.current || activity.kind !== "ready") return false;
    sending.current = true;
    const controller = new AbortController();
    activeRequest.current = controller;
    const assistantId = crypto.randomUUID();
    let chatStarted = false;
    setOperationError("");
    setConfirmClear(false);
    try {
      setActivity({ kind: file ? "uploading" : "streaming" });
      const imageUrl = file ? await uploadImage(file, controller.signal) : undefined;
      if (controller.signal.aborted) return false;
      const id = selectedId || crypto.randomUUID();
      localStorage.setItem("thread_id", id);
      setSelectedId(id);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", content: text, imageUrl },
        { id: assistantId, role: "assistant", content: "", status: "streaming" },
      ]);
      chatStarted = true;
      setActivity({ kind: "streaming" });
      await streamChat(
        { message: text, imageUrl, threadId: id },
        (chunk) => setMessages((current) => current.map((message) =>
          message.id === assistantId && message.role === "assistant"
            ? { ...message, content: message.content + chunk }
            : message,
        )),
        controller.signal,
      );
      setMessages((current) => current.map((message) =>
        message.id === assistantId && message.role === "assistant"
          ? { ...message, content: message.content || "模型沒有回傳內容，請重試。", status: message.content ? "complete" : "error" }
          : message,
      ));
      return true;
    } catch (error) {
      const stopped = controller.signal.aborted;
      const detail = error instanceof Error ? error.message : "取得回覆失敗。";
      if (chatStarted) {
        setMessages((current) => current.map((message) =>
          message.id === assistantId && message.role === "assistant"
            ? {
                ...message,
                content: stopped ? message.content || "已停止產生回覆。" : [message.content, detail].filter(Boolean).join("\n\n"),
                status: stopped ? "stopped" : "error",
              }
            : message,
        ));
      } else {
        setOperationError(stopped ? "已取消圖片上傳，可以重新傳送。" : detail);
      }
      return false;
    } finally {
      sending.current = false;
      setActivity({ kind: "ready" });
      if (chatStarted) void refreshThreads();
    }
  }

  async function clearMessages() {
    if (!selectedId) return;
    const id = selectedId;
    const controller = new AbortController();
    activeRequest.current = controller;
    setActivity({ kind: "clearing" });
    setOperationError("");
    try {
      await clearChatHistory(id, controller.signal);
      setThreads((current) => current.filter((thread) => thread.thread_id !== id));
      await loadConversation(null);
      void refreshThreads();
    } catch (error) {
      if (controller.signal.aborted) return;
      setOperationError(error instanceof Error ? error.message : "清空對話失敗。");
      setActivity(activity);
    }
  }

  const busy = activity.kind === "uploading" || activity.kind === "streaming" || activity.kind === "clearing";
  const title = selectedId ? threads.find((thread) => thread.thread_id === selectedId)?.title || "目前對話" : "新對話";

  return (
    <main className="flex h-dvh overflow-hidden bg-zinc-50">
      <ConversationSidebar
        threads={threads} currentThreadId={selectedId} open={sidebarOpen} busy={busy}
        loading={listLoading} error={listError} onClose={() => setSidebarOpen(false)}
        onNew={() => void loadConversation(null)} onSelect={(id) => void loadConversation(id)}
        onRefresh={() => void refreshThreads()}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader title={title} onOpenSidebar={() => setSidebarOpen(true)} onClear={() => setConfirmClear(true)} clearDisabled={busy || activity.kind === "loading" || !selectedId} />
        {confirmClear && (
          <div className="border-b border-orange-200 bg-orange-50 px-4 py-3" role="group" aria-label="清空對話確認">
            <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 text-sm text-zinc-800">
              <p className="flex-1">確定清空這個對話的所有訊息？此操作無法復原。</p>
              <button className="secondary-button" onClick={() => setConfirmClear(false)} disabled={busy}>取消</button>
              <button className="primary-button" onClick={() => void clearMessages()} disabled={busy}>{activity.kind === "clearing" ? "正在清空…" : "確認清空"}</button>
            </div>
          </div>
        )}
        {operationError && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{operationError}</p>}
        <section className="min-h-0 flex-1 overflow-y-auto" aria-label="聊天訊息" aria-busy={activity.kind === "loading"}>
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
            {activity.kind === "loading" ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-sm text-zinc-500" role="status"><LoaderCircle size={18} className="animate-spin" />正在讀取聊天歷史…</div>
            ) : activity.kind === "history_error" ? (
              <div className="my-auto rounded-lg border border-red-200 bg-red-50 p-5" role="alert">
                <p className="font-medium text-red-900">無法載入聊天歷史</p>
                <p className="mt-2 text-sm text-red-800">{activity.message}</p>
                <button className="secondary-button mt-4" onClick={() => void loadConversation(selectedId)}>重新載入</button>
              </div>
            ) : messages.length === 0 ? <EmptyState disabled={activity.kind !== "ready"} onPrompt={(prompt) => void sendMessage(prompt)} />
              : messages.map((message) => <ChatMessage key={message.id} message={message} />)}
            <div ref={messagesEnd} />
          </div>
        </section>
        <div className="border-t border-zinc-200 bg-white">
          {activity.kind === "uploading" && <p role="status" className="px-4 pt-3 text-sm text-zinc-500">正在上傳圖片…</p>}
          <ChatInput key={composerRevision} onSend={sendMessage} disabled={activity.kind !== "ready"} onStop={activity.kind === "streaming" || activity.kind === "uploading" ? () => activeRequest.current?.abort() : undefined} />
        </div>
      </div>
    </main>
  );
}
