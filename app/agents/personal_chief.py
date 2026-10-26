from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_core.messages import (
    HumanMessage,
    AIMessageChunk,
)
import sqlite3
from langgraph.checkpoint.sqlite import SqliteSaver
from langchain_tavily import TavilySearch
from app.common.logger import logger

load_dotenv()

conntection = sqlite3.connect("./app/db/personal_chief.db", check_same_thread=False)

checkpointer = SqliteSaver(conntection)

checkpointer.setup()  # auto create tables in SQLite


web_search = TavilySearch(max_results=5, topic="general")

system_prompt = """
You are a private chef. After receiving photos or a list of ingredients provided by the user, please follow the process below:

1. Identify and Evaluate Ingredients: If the user provides photos, first identify all visible ingredients. Assess their freshness and available quantities based on their appearance, and compile a "Currently Available Ingredients List."

2. Intelligent Recipe Search: Prioritize using the web_search tool to search for feasible recipes based on the core keywords from the "Currently Available Ingredients List."

3. Multidimensional Evaluation and Ranking: Quantitatively score the retrieved candidate recipes based on two dimensions: nutritional value and preparation difficulty. Rank the recipes according to their scores, giving higher rankings to recipes that are easy to prepare and rich in nutrients.

4. Structured Recommendation Output: Organize the ranked recipes into a clearly structured recommendation report, including recipe information, scores, reasons for recommendation, and reference images of the dishes to help the user make a quick decision.

Please strictly follow the process above and prioritize using the web_search tool to search for recipes. Only create your own recipes if no relevant recipes can be found through the search.
"""

agent = create_agent(
    model="deepseek-flash",
    system_prompt=system_prompt,
    tools=[web_search],
    checkpointer=checkpointer,
)

# LangGraph will automatically handle the state management and checkpointing for the agent.
# it also handles the Restful API for the agent.


async def search_recipes(prompt: str, image_url: str, thread_id: str):
    logger.info("Searching recipes: thread_id=%s, has_image=%s", thread_id, bool(image_url))
    try:
        if not image_url or image_url.strip() == "":
            message = HumanMessage(content=prompt)
        else:
            message = HumanMessage(
                content=[
                    {"type": "text", "text": prompt},
                    {"type": "image", "url": image_url},
                ]
            )

        for chunk, metadata in agent.stream(
            {"messages": [message]},
            {"configurable": {"thread_id": thread_id}},
            stream_mode="messages",
        ):
            if isinstance(chunk, AIMessageChunk) and chunk.content:
                yield chunk.content
    except Exception as e:
        logger.error(f"Error: {e}")
        yield "Error occurred while searching recipes. Try typing the ingredients."
