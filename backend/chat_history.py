"""Saved chat history for logged-in shoppers, stored in the chat_messages table.

Every query is filtered by user_id, and callers only ever pass the id of the user from the
session cookie, so one shopper's conversation is never read or written for another.
"""

import json
import sqlite3
from pathlib import Path

from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, TextPart, UserPromptPart

from models import ChatHistoryMessage, ChatReply
from tools import product_cards

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "campus_customs.db"

# How much past conversation to reload in the widget and to send to the agent.
HISTORY_DISPLAY_LIMIT = 50
HISTORY_AGENT_LIMIT = 20


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _product_ids(products_json: str | None) -> list[str]:
    if not products_json:
        return []
    try:
        return [p["product_id"] for p in json.loads(products_json) if isinstance(p, dict) and "product_id" in p]
    except (ValueError, TypeError):
        return []


def _recent_rows(user_id: int, limit: int) -> list[sqlite3.Row]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT role, content, products_json, created_at FROM chat_messages "
            "WHERE user_id = ? AND role IN ('user', 'assistant') ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return list(reversed(rows))


def load_history(user_id: int) -> list[ChatHistoryMessage]:
    """The user's recent messages for the chat widget. Product cards are rebuilt from the
    database so they show current names, prices, and images."""
    return [
        ChatHistoryMessage(
            role=r["role"],
            content=r["content"],
            products=product_cards(_product_ids(r["products_json"])),
            created_at=r["created_at"],
        )
        for r in _recent_rows(user_id, HISTORY_DISPLAY_LIMIT)
    ]


def agent_history(user_id: int) -> list[ModelMessage]:
    """The user's recent messages in PydanticAI's format, so the agent remembers the conversation."""
    messages: list[ModelMessage] = []
    for r in _recent_rows(user_id, HISTORY_AGENT_LIMIT):
        if r["role"] == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=r["content"])]))
        else:
            text = r["content"]
            ids = _product_ids(r["products_json"])
            if ids:
                # Lets the agent resolve follow-ups like "the second one" or "that hoodie".
                text += "\n[Product cards shown: " + ", ".join(ids) + "]"
            messages.append(ModelResponse(parts=[TextPart(content=text)]))
    # The history must start with a request; drop a leading assistant message if the limit cut one off.
    while messages and isinstance(messages[0], ModelResponse):
        messages.pop(0)
    return messages


def save_exchange(user_id: int, user_message: str, reply: ChatReply) -> None:
    """Store one user message and the assistant's reply (with its product cards)."""
    products_json = json.dumps([p.model_dump() for p in reply.products]) if reply.products else None
    with _connect() as conn:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'user', ?)",
            (user_id, user_message),
        )
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'assistant', ?, ?)",
            (user_id, reply.reply, products_json),
        )
