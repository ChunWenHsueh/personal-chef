import importlib.util
from pathlib import Path
import sqlite3
import sys
from types import ModuleType
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, MessagesState, StateGraph

from app.common.chat_history import clear_messages, get_messages, list_threads


class ChatHistoryTests(unittest.TestCase):
    def setUp(self):
        connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.addCleanup(connection.close)
        self.saver = SqliteSaver(connection)
        self.saver.setup()
        builder = StateGraph(MessagesState)
        builder.add_node("reply", lambda state: {"messages": [AIMessage(content="可以做一道家常菜。")]} )
        builder.add_edge(START, "reply")
        builder.add_edge("reply", END)
        self.graph = builder.compile(checkpointer=self.saver)

    def send(self, thread_id, content):
        self.graph.invoke({"messages": [HumanMessage(content=content)]},
                          {"configurable": {"thread_id": thread_id}})

    def test_empty_history_does_not_create_a_conversation(self):
        self.assertEqual(list_threads(self.saver), [])
        self.assertEqual(get_messages(self.saver, "not-created"), [])
        self.assertEqual(list(self.saver.list(None)), [])

    def test_threads_are_unique_newest_first_and_keep_the_first_title(self):
        self.send("breakfast", "雞蛋早餐")
        self.send("dinner", "豆腐晚餐")
        self.send("breakfast", "再加一些番茄")
        threads = list_threads(self.saver)
        self.assertEqual([thread.thread_id for thread in threads], ["breakfast", "dinner"])
        self.assertEqual(threads[0].title, "雞蛋早餐")
        self.assertEqual(threads[0].last_message, "可以做一道家常菜。")
        self.assertLess(threads[0].created_at, threads[0].updated_at)
        self.assertEqual(len(get_messages(self.saver, "breakfast")), 4)

    def test_image_message_title_uses_text_and_history_keeps_image_url(self):
        content = [{"type": "text", "text": "看看這些食材"},
                   {"type": "image", "url": "https://example.com/food.jpg?signed=test"}]
        self.send("image-chat", content)
        self.assertEqual(list_threads(self.saver)[0].title, "看看這些食材")
        self.assertEqual(get_messages(self.saver, "image-chat")[0]["content"], content)

    def test_clearing_one_conversation_preserves_the_others(self):
        self.send("one", "早餐")
        self.send("two", "晚餐")
        clear_messages(self.saver, "one")
        self.assertEqual(get_messages(self.saver, "one"), [])
        self.assertEqual([thread.thread_id for thread in list_threads(self.saver)], ["two"])

    def test_thread_list_and_selected_history_http_contract(self):
        fake_agent = ModuleType("app.agents.personal_chief")
        fake_agent.checkpointer = self.saver
        async def fake_search(*args):
            yield "測試回覆"
        fake_agent.search_recipes = fake_search
        path = Path(__file__).resolve().parents[1] / "app/api/v1/chat.py"
        spec = importlib.util.spec_from_file_location("isolated_chat_router", path)
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"app.agents.personal_chief": fake_agent}):
            spec.loader.exec_module(module)
        app = FastAPI()
        app.include_router(module.router, prefix="/api/v1")
        self.send("saved", "我想煮晚餐")
        with TestClient(app) as client:
            response = client.get("/api/v1/chat/threads")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["threads"][0]["thread_id"], "saved")
            response = client.get("/api/v1/chat/messages", params={"thread_id": "saved"})
            self.assertEqual(response.json()["messages"][0]["content"], "我想煮晚餐")
            response = client.delete("/api/v1/chat/messages", params={"thread_id": "saved"})
            self.assertEqual(response.json(), {"success": True})
            self.assertEqual(client.get("/api/v1/chat/threads").json(), {"threads": []})


if __name__ == "__main__":
    unittest.main()
