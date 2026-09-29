"""Append-only audit trail of agent runs: output/audit_trail.json.

One entry per shopper message (one agent-loop run): when it ran, who (user id or "guest", never
an email), a short and redacted message preview, each tool call with short arguments and a short
result, how the run stopped, and usage counts. Only observable actions are recorded, never the
model's private reasoning.

The file is a JSON array. New runs are added to the end and existing entries are never rewritten
or removed. Writes go through a lock and an atomic replace, so the file is always valid JSON.
"""

import json
import logging
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pydantic_ai.messages import ModelMessage, ToolCallPart, ToolReturnPart

from models import ProductDetails, ProductNotFound, SearchResults, StockCheck, ToolFailure

logger = logging.getLogger("campus_customs.audit")

AUDIT_PATH = Path(__file__).resolve().parent.parent / "output" / "audit_trail.json"
MAX_TEXT = 160
_lock = threading.Lock()

# Redact anything that looks like a payment card, an email address, or a stated password.
_CARD = re.compile(r"\b\d(?:[ -]?\d){12,18}\b")
_CARD_CODE = re.compile(r"\b(cvv|cvc|security code)\b\s*[:=]?\s*\d{3,4}\b", re.IGNORECASE)
_EXPIRY = re.compile(r"\b(0[1-9]|1[0-2])\s*/\s*(\d{4}|\d{2})\b")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PASSWORD = re.compile(r"\b(password|passcode|pwd)(\s*(?:is|:|=)\s*)[^\s,.;!?]+", re.IGNORECASE)


def redact(text: str) -> str:
    text = _CARD.sub("[card number removed]", text)
    text = _CARD_CODE.sub(r"\1 [removed]", text)
    text = _EXPIRY.sub("[date removed]", text)
    text = _EMAIL.sub("[email removed]", text)
    return _PASSWORD.sub(r"\1\2[removed]", text)


def short(text: str, limit: int = MAX_TEXT) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _summarize_result(content) -> str:
    if isinstance(content, SearchResults):
        ids = ", ".join(p.product_id for p in content.products)
        return short(f"{content.showing} of {content.total_matches} matches (exact_match={content.exact_match}): {ids}")
    if isinstance(content, ProductDetails):
        return short(f"{content.product_id} ${content.price:.2f}; in stock: {', '.join(content.sizes_in_stock) or 'none'}")
    if isinstance(content, StockCheck):
        return short(f"{content.status}: {content.message}")
    if isinstance(content, (ProductNotFound, ToolFailure)):
        return short(content.message)
    return short(content)


def tool_steps(messages: list[ModelMessage]) -> list[dict]:
    """Tool calls from a run, paired with their results, in order."""
    calls: dict[str, dict] = {}
    steps: list[dict] = []
    for message in messages:
        for part in getattr(message, "parts", []):
            if isinstance(part, ToolCallPart):
                if part.tool_name == "final_result":  # the structured-answer tool, not a lookup
                    continue
                step = {"tool": part.tool_name, "args": short(redact(part.args_as_json_str()), 120), "result": None}
                calls[part.tool_call_id] = step
                steps.append(step)
            elif isinstance(part, ToolReturnPart) and part.tool_call_id in calls:
                calls[part.tool_call_id]["result"] = _summarize_result(part.content)
    return steps


def record_run(
    *,
    started: datetime,
    user_id: int | None,
    page: str,
    message: str,
    messages: list[ModelMessage],
    stop_reason: str,
    reply: str,
    products: list[str],
    requests: int | None = None,
) -> None:
    """Append one run to the audit trail. Never raises: auditing must not break the chat."""
    finished = datetime.now(timezone.utc)
    entry = {
        "run_id": uuid.uuid4().hex[:12],
        "time": started.isoformat(timespec="seconds"),
        "duration_ms": int((finished - started).total_seconds() * 1000),
        "user": f"user:{user_id}" if user_id is not None else "guest",
        "page": short(page, 80),
        "message": short(redact(message), 120),
        "tool_calls": tool_steps(messages),
        "stop_reason": stop_reason,
        "model_requests": requests,
        "reply": short(redact(reply)),
        "products_shown": products,
    }
    try:
        with _lock:
            AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
            entries = []
            if AUDIT_PATH.exists():
                raw = AUDIT_PATH.read_text(encoding="utf-8").strip()
                entries = json.loads(raw) if raw else []
                if not isinstance(entries, list):
                    raise ValueError("audit_trail.json is not a JSON array")
            entries.append(entry)
            tmp = AUDIT_PATH.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, AUDIT_PATH)
    except Exception:
        # A corrupt or unreadable file is left untouched (never overwritten), and the chat still works.
        logger.exception("Couldn't append to the audit trail")
