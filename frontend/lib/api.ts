import type { ConversationThread, Message, StreamChatRequest } from "@/types/chat";

function apiUrl(path: string): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const base = configured
    ? configured.replace(/\/$/, "")
    : typeof window !== "undefined" && window.location.port !== "3000"
      ? window.location.origin
      : "http://localhost:8001";
  return base + path;
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null) {
      if ("detail" in payload && typeof payload.detail === "string") return payload.detail;
      if ("message" in payload && typeof payload.message === "string") return payload.message;
    }
  } catch {
    return `${fallback}（HTTP ${response.status}）`;
  }
  return `${fallback}（HTTP ${response.status}）`;
}

function readContent(value: unknown): { content: string; imageUrl?: string } {
  if (typeof value === "string") return { content: value };
  if (!Array.isArray(value)) throw new Error("聊天歷史的內容格式不正確。");

  const text: string[] = [];
  let imageUrl: string | undefined;
  const blocks: unknown[] = value;
  for (const block of blocks) {
    if (typeof block !== "object" || block === null) continue;
    if ("type" in block && block.type === "text" && "text" in block && typeof block.text === "string") {
      text.push(block.text);
    } else if ("type" in block && block.type === "image" && "url" in block && typeof block.url === "string") {
      imageUrl = block.url;
    } else if ("image_url" in block && typeof block.image_url === "object" && block.image_url !== null && "url" in block.image_url && typeof block.image_url.url === "string") {
      imageUrl = block.image_url.url;
    }
  }
  return { content: text.join("\n"), imageUrl };
}

export async function getChatHistory(threadId: string, signal?: AbortSignal): Promise<Message[]> {
  const query = new URLSearchParams({ thread_id: threadId });
  const response = await fetch(apiUrl("/api/v1/chat/messages?" + query), { signal });
  if (!response.ok) throw new Error(await errorMessage(response, "讀取聊天歷史失敗"));

  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("messages" in payload) || !Array.isArray(payload.messages)) {
    throw new Error("聊天歷史的回傳格式不正確。");
  }
  return payload.messages.map((entry: unknown, index: number): Message => {
    if (typeof entry !== "object" || entry === null || !("role" in entry) || !("content" in entry)) {
      throw new Error("聊天歷史的訊息格式不正確。");
    }
    const { content, imageUrl } = readContent(entry.content);
    const id = `history-${index}`;
    if (entry.role === "user") return { id, role: "user", content, imageUrl };
    if (entry.role === "assistant") return { id, role: "assistant", content, status: "complete" };
    throw new Error("聊天歷史包含不支援的訊息角色。");
  });
}

export async function streamChat(
  request: StreamChatRequest,
  onChunk: (text: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(apiUrl("/api/v1/chat/stream"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: request.message,
      image_url: request.imageUrl || null,
      thread_id: request.threadId,
    }),
    signal,
  });
  if (!response.ok) throw new Error(await errorMessage(response, "取得回覆失敗"));
  if (!response.body) throw new Error("瀏覽器無法讀取串流回覆。");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) onChunk(text);
    }
    const remaining = decoder.decode();
    if (remaining) onChunk(remaining);
  } finally {
    reader.releaseLock();
  }
}

export async function clearChatHistory(threadId: string, signal: AbortSignal): Promise<void> {
  const query = new URLSearchParams({ thread_id: threadId });
  const response = await fetch(apiUrl("/api/v1/chat/messages?" + query), {
    method: "DELETE",
    signal,
  });
  if (!response.ok) throw new Error(await errorMessage(response, "清空對話失敗"));
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("success" in payload) || payload.success !== true) {
    throw new Error("後端尚未確認對話已清空。");
  }
}

export async function getConversationThreads(signal: AbortSignal): Promise<ConversationThread[]> {
  const response = await fetch(apiUrl("/api/v1/chat/threads"), { signal });
  if (!response.ok) throw new Error(await errorMessage(response, "讀取對話列表失敗"));
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("threads" in payload) || !Array.isArray(payload.threads)) {
    throw new Error("對話列表的回傳格式不正確。");
  }
  return payload.threads.map((entry: unknown): ConversationThread => {
    if (typeof entry !== "object" || entry === null
      || !("thread_id" in entry) || typeof entry.thread_id !== "string"
      || !("title" in entry) || typeof entry.title !== "string"
      || !("last_message" in entry) || typeof entry.last_message !== "string"
      || !("created_at" in entry) || typeof entry.created_at !== "string"
      || !("updated_at" in entry) || typeof entry.updated_at !== "string") {
      throw new Error("對話列表包含格式不正確的項目。");
    }
    return {
      thread_id: entry.thread_id, title: entry.title, last_message: entry.last_message,
      created_at: entry.created_at, updated_at: entry.updated_at,
    };
  });
}

const imageExtensions = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/gif", "gif"], ["image/webp", "webp"],
]);
const uploadKeys = new WeakMap<File, string>();

export function imageValidationError(file: File): string | undefined {
  if (!imageExtensions.has(file.type)) return "請選擇 JPG、PNG、GIF 或 WebP 圖片。";
  if (file.size === 0) return "圖片檔案是空的，請重新選擇。";
  if (file.size > 10 * 1024 * 1024) return "圖片不能超過 10 MB。";
}

export async function uploadImage(file: File, signal: AbortSignal): Promise<string> {
  const validationError = imageValidationError(file);
  if (validationError) throw new Error(validationError);
  let filename = uploadKeys.get(file);
  if (!filename) {
    const extension = file.type.slice("image/".length).replace("jpeg", "jpg");
    filename = `${crypto.randomUUID()}.${extension}`;
    uploadKeys.set(file, filename);
  }
  const query = new URLSearchParams({ filename });
  const response = await fetch(apiUrl("/api/v1/oss/presign?" + query), { signal });
  if (!response.ok) throw new Error(await errorMessage(response, "取得圖片上傳網址失敗"));
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null
    || !("uploadUrl" in payload) || typeof payload.uploadUrl !== "string"
    || !("accessUrl" in payload) || typeof payload.accessUrl !== "string"
    || !("contentType" in payload) || typeof payload.contentType !== "string") {
    throw new Error("圖片上傳網址的回傳格式不正確。");
  }
  let uploaded: Response;
  try {
    uploaded = await fetch(payload.uploadUrl, {
      method: "PUT", body: file, headers: { "Content-Type": payload.contentType },
      credentials: "omit", signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    const origin = typeof window !== "undefined" ? window.location.origin : "目前前端來源";
    throw new Error(`圖片上傳無法連線到 S3，請確認 bucket 的 CORS 允許 ${origin}，並檢查區域與網路設定。`, { cause: error });
  }
  if (!uploaded.ok) throw new Error(`圖片上傳失敗（HTTP ${uploaded.status}），請重試。`);
  return payload.accessUrl;
}
