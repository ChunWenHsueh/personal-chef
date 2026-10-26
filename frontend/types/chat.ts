export type Message =
  | {
      id: string;
      role: "user";
      content: string;
      imageUrl?: string;
    }
  | {
      id: string;
      role: "assistant";
      content: string;
      status: "streaming" | "complete" | "stopped" | "error";
    };

export interface StreamChatRequest {
  message: string;
  imageUrl?: string;
  threadId: string;
}

export interface ConversationThread {
  thread_id: string;
  title: string;
  last_message: string;
  created_at: string;
  updated_at: string;
}
