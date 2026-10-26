from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.checkpoint.sqlite import SqliteSaver

from app.models.schemas import ConversationThread


def _message_text(message: BaseMessage) -> str:
    if isinstance(message.content, str):
        return message.content
    return "\n".join(
        block if isinstance(block, str) else block.get("text", "")
        for block in message.content
    )


def get_messages(checkpointer: SqliteSaver, thread_id: str) -> list[dict[str, object]]:
    checkpoint = checkpointer.get({"configurable": {"thread_id": thread_id}})
    if not checkpoint:
        return []
    messages = checkpoint.get("channel_values", {}).get("messages", [])
    return [
        {"role": "user" if isinstance(message, HumanMessage) else "assistant", "content": message.content}
        for message in messages
        if isinstance(message, (HumanMessage, AIMessage)) and message.content
    ]


def list_threads(checkpointer: SqliteSaver) -> list[ConversationThread]:
    threads: dict[str, ConversationThread] = {}
    seen: set[str] = set()
    for snapshot in checkpointer.list(None):
        config = snapshot.config["configurable"]
        if config.get("checkpoint_ns", ""):
            continue
        thread_id = config["thread_id"]
        timestamp = snapshot.checkpoint["ts"]
        if thread_id in seen:
            if thread_id in threads:
                threads[thread_id].created_at = timestamp
            continue
        seen.add(thread_id)
        messages = snapshot.checkpoint.get("channel_values", {}).get("messages", [])
        user_messages = [message for message in messages if isinstance(message, HumanMessage)]
        if not user_messages:
            continue
        title = " ".join(_message_text(user_messages[0]).split())[:60] or "圖片對話"
        last_message = next(
            (
                " ".join(_message_text(message).split())[:160]
                for message in reversed(messages)
                if isinstance(message, (HumanMessage, AIMessage)) and _message_text(message).strip()
            ),
            "圖片對話",
        )
        threads[thread_id] = ConversationThread(
            thread_id=thread_id,
            title=title,
            last_message=last_message,
            created_at=timestamp,
            updated_at=timestamp,
        )
    return sorted(threads.values(), key=lambda thread: thread.updated_at, reverse=True)


def clear_messages(checkpointer: SqliteSaver, thread_id: str) -> None:
    checkpointer.delete_thread(thread_id)
