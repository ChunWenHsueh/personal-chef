from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.agents.personal_chief import checkpointer, search_recipes
from app.common.chat_history import clear_messages, get_messages, list_threads
from app.models.schemas import ChatRequest, ConversationThread


router = APIRouter()


@router.post("/chat/stream")
async def chat_endpoint(request: ChatRequest):
    return StreamingResponse(
        search_recipes(
            request.message,
            request.image_url,
            request.thread_id,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/chat/threads", response_model=dict[str, list[ConversationThread]])
def get_chat_threads():
    return {"threads": list_threads(checkpointer)}


@router.get("/chat/messages")
def get_chat_messages(thread_id: str):
    return {"messages": get_messages(checkpointer, thread_id)}


@router.delete("/chat/messages")
def clear_chat_messages(thread_id: str):
    clear_messages(checkpointer, thread_id)
    return {"success": True}
