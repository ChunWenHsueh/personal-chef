from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    image_url: str | None = None
    thread_id: str = Field(min_length=1, max_length=128)


class IngredientDetectionRequest(BaseModel):
    image_url: str = Field(min_length=1)
    hint: str = Field(default="", max_length=500)


class IngredientItem(BaseModel):
    name: str = Field(description="食材的常用中文名称")
    amount_hint: str | None = Field(
        default=None,
        description="只能根据图片粗略判断的数量，例如两个、一小把；无法判断时为空",
    )
    confidence: Literal["high", "medium", "low"] = Field(
        description="视觉识别置信度，不代表食用安全性"
    )


class IngredientDetection(BaseModel):
    ingredients: list[IngredientItem] = Field(
        default_factory=list,
        max_length=30,
        description="图片中能够辨认的食材",
    )
    notes: list[str] = Field(
        default_factory=list,
        description="遮挡、模糊或需要用户确认的视觉问题",
    )
    needs_confirmation: bool = Field(
        default=True,
        description="图片识别结果始终需要用户确认",
    )


class SourceReference(BaseModel):
    id: str = Field(description="工具返回的稳定来源 ID")
    source_type: Literal["local", "web"]
    title: str
    reference: str = Field(description="本地文件名或网页 URL")
    relevance: float | None = Field(default=None, ge=0, le=1)


class RecipeIngredient(BaseModel):
    name: str
    amount: str | None = None


class RecipeStep(BaseModel):
    order: int = Field(ge=1)
    instruction: str
    duration_minutes: int | None = Field(default=None, ge=1, le=600)


class RecipeOption(BaseModel):
    title: str
    summary: str
    difficulty: str
    cooking_time_minutes: int | None = Field(default=None, ge=1, le=600)
    servings: int | None = Field(default=None, ge=1, le=20)
    match_reasons: list[str] = Field(default_factory=list, max_length=6)
    ingredients: list[RecipeIngredient] = Field(default_factory=list, max_length=40)
    steps: list[RecipeStep] = Field(default_factory=list, max_length=30)
    source_ids: list[str] = Field(default_factory=list, max_length=10)


class ChefResponse(BaseModel):
    summary: str = Field(description="面向用户的简短推荐结论")
    identified_ingredients: list[str] = Field(default_factory=list, max_length=30)
    recipes: list[RecipeOption] = Field(default_factory=list, max_length=3)
    sources: list[SourceReference] = Field(default_factory=list, max_length=12)
    safety_notes: list[str] = Field(default_factory=list, max_length=8)
    needs_confirmation: bool = False
    confirmation_question: str | None = None


class StoredChatMessage(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    image_url: str | None = None
    result: ChefResponse | None = None
    created_at: str


class ConversationThread(BaseModel):
    thread_id: str
    title: str
    last_message: str
    created_at: str
    updated_at: str
