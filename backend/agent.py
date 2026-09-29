"""PydanticAI agent behind the Campus Customs chat widget.

Model settings come from the environment (or a .env file); no secrets are stored in code:
  PORTKEY_API_KEY    Portkey gateway key (if unset, falls back to OPENAI_API_KEY directly)
  PORTKEY_BASE_URL   default https://api.portkey.ai/v1
  PORTKEY_PROVIDER   default openai
  CHAT_MODEL         default gpt-5.6-luna
"""

import asyncio
from datetime import datetime, timezone
import logging
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic_ai import Agent, RunContext, UsageLimits, capture_run_messages
from pydantic_ai.exceptions import ModelHTTPError, UsageLimitExceeded
from pydantic_ai.messages import ModelMessage, ToolReturnPart
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

import audit
from auth import PublicUser
from models import (
    AgentReply,
    ChatReply,
    PageContext,
    ProductDetails,
    ProductSummary,
    SearchResults,
    StockCheck,
    ToolFailure,
)
from tools import CATALOGUE_TOOLS, find_product_summary, product_cards

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR.parent / ".env")

PROMPT_PATH = BACKEND_DIR / "prompts" / "prompt.md"
logger = logging.getLogger("campus_customs.agent")

# Hard limits per shopper message so one question can't trigger runaway model or tool calls:
# enough for a search, a details/stock lookup or two, and the final answer.
USAGE_LIMITS = UsageLimits(request_limit=6, tool_calls_limit=8, total_tokens_limit=80_000)
RUN_TIMEOUT_SECONDS = 60  # whole agent run
MODEL_TIMEOUT_SECONDS = 30  # each model request
MODEL_MAX_RETRIES = 1  # network/5xx retries per model request


@dataclass
class ChatDeps:
    """Per-message context passed to the agent as PydanticAI dependencies.

    Built by the backend: the user comes from the session cookie, and the viewed product is
    looked up in the database from the page's product_id (never trusted from the browser).
    """

    user_name: str | None = None
    user_email: str | None = None
    page_path: str = "/"
    viewing_product: ProductSummary | None = None


def build_deps(user: PublicUser | None, page: PageContext | None) -> ChatDeps:
    viewing = find_product_summary(page.product_id) if page and page.product_id else None
    return ChatDeps(
        user_name=user.name if user else None,
        user_email=user.email if user else None,
        page_path=page.path if page else "/",
        viewing_product=viewing,
    )


def context_instructions(ctx: RunContext[ChatDeps]) -> str:
    """Added to the system prompt for each message: who the shopper is and what they're viewing."""
    d = ctx.deps
    lines = ["## Current conversation context"]
    if d.user_name:
        lines.append(f"- The shopper is logged in as {d.user_name} (email: {d.user_email}).")
    else:
        lines.append("- The shopper is not logged in, so you don't know their name, and this conversation won't be saved.")
    lines.append(f"- They are on the page {d.page_path}.")
    if d.viewing_product:
        p = d.viewing_product
        lines.append(
            f'- They are viewing the product page for "{p.name}" (product_id: {p.product_id}). '
            'If they say "this", "it", or "this one" without naming a product, they mean this product.'
        )
    else:
        lines.append("- They are not on a single-product page.")
    return "\n".join(lines)


def make_agent() -> Agent[ChatDeps, AgentReply]:
    model_name = os.getenv("CHAT_MODEL", "gpt-5.6-luna")
    portkey_api_key = os.getenv("PORTKEY_API_KEY")
    if portkey_api_key:
        client = AsyncOpenAI(
            api_key=portkey_api_key,
            timeout=MODEL_TIMEOUT_SECONDS,
            max_retries=MODEL_MAX_RETRIES,
            base_url=os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1"),
            default_headers={
                "x-portkey-api-key": portkey_api_key,
                "x-portkey-provider": os.getenv("PORTKEY_PROVIDER", "openai"),
            },
        )
        model = OpenAIChatModel(model_name, provider=OpenAIProvider(openai_client=client))
    else:
        model = f"openai:{model_name}"
    return Agent(
        model,
        deps_type=ChatDeps,
        output_type=AgentReply,
        instructions=[PROMPT_PATH.read_text(encoding="utf-8"), context_instructions],
        tools=CATALOGUE_TOOLS,
        # Retry budgets: invalid tool-call arguments, and a structured answer that doesn't validate.
        retries={"tools": 1, "output": 2},
    )


_agent: Agent[ChatDeps, AgentReply] | None = None


def get_agent() -> Agent[ChatDeps, AgentReply]:
    # Built on first use so the API still starts if model settings are missing.
    global _agent
    if _agent is None:
        _agent = make_agent()
    return _agent


SAFETY_REFUSAL = (
    "Sorry, I can't help with that. I'm here to help you find Campus Customs gear, "
    "so let me know what you're shopping for!"
)
LOOKUP_GAVE_UP = (
    "Sorry, I couldn't pin that down in our catalogue. Could you describe it another way "
    "(for example the style, color, or college), or browse the Products page?"
)
TIMED_OUT = (
    "Sorry, that took longer than expected. Please try asking again, or browse the Products "
    "page, where you can search and filter everything we carry."
)
UNAVAILABLE = (
    "Sorry, I'm having trouble right now. Please try again in a moment. In the meantime, the "
    "Products page lets you search and filter everything we carry."
)


def _is_content_filtered(error: ModelHTTPError) -> bool:
    return error.status_code == 400 and "content" in str(error.body).lower() and "filter" in str(error.body).lower()


def _looked_up_ids(messages: list[ModelMessage]) -> set[str]:
    """product_ids that the catalogue tools actually returned during this run."""
    ids: set[str] = set()
    for message in messages:
        for part in getattr(message, "parts", []):
            if not isinstance(part, ToolReturnPart):
                continue
            content = part.content
            if isinstance(content, SearchResults):
                ids.update(p.product_id for p in content.products)
            elif isinstance(content, (ProductDetails, StockCheck)):
                ids.add(content.product_id)
    return ids


def _had_tool_failure(messages: list[ModelMessage]) -> bool:
    return any(
        isinstance(part, ToolReturnPart) and isinstance(part.content, ToolFailure)
        for message in messages
        for part in getattr(message, "parts", [])
    )


async def chat(
    message: str, deps: ChatDeps, history: list[ModelMessage] | None = None, user_id: int | None = None
) -> ChatReply:
    """Run the agent for one shopper message and record the run in the audit trail. Never raises:
    every failure becomes a helpful fallback reply (fallback=True), which isn't saved to the
    shopper's history."""
    started = datetime.now(timezone.utc)
    result = None
    with capture_run_messages() as run_messages:
        try:
            result = await asyncio.wait_for(
                get_agent().run(message, deps=deps, message_history=history, usage_limits=USAGE_LIMITS),
                timeout=RUN_TIMEOUT_SECONDS,
            )
            reply, stop = _reply_from(result), "final_answer"
        except UsageLimitExceeded:
            # The agent kept calling tools without settling on an answer; don't guess.
            logger.warning("Usage limit reached for message: %.80s", message)
            reply, stop = ChatReply(reply=LOOKUP_GAVE_UP, fallback=True), "usage_limit_reached"
        except TimeoutError:
            logger.warning("Agent run timed out after %ss", RUN_TIMEOUT_SECONDS)
            reply, stop = ChatReply(reply=TIMED_OUT, fallback=True), "timeout"
        except ModelHTTPError as e:
            # The model provider's content filter blocks some messages (e.g. jailbreak attempts).
            # Treat that as a refusal rather than an outage.
            if _is_content_filtered(e):
                reply, stop = ChatReply(reply=SAFETY_REFUSAL, fallback=True), "blocked_by_content_filter"
            else:
                logger.exception("Model request failed")
                reply, stop = ChatReply(reply=UNAVAILABLE, fallback=True), "model_error"
        except Exception:
            # Connection errors, invalid structured output after retries, or anything unexpected.
            logger.exception("Chat agent failed")
            reply, stop = ChatReply(reply=UNAVAILABLE, fallback=True), "error"
    if stop == "final_answer" and reply.fallback:
        stop = "final_answer_after_tool_failure"
    # Only this run's messages (not the reloaded history) go in the audit entry.
    new = result.new_messages() if result else run_messages[len(history or []):]
    audit.record_run(
        started=started,
        user_id=user_id,
        page=deps.page_path,
        message=message,
        messages=new,
        stop_reason=stop,
        reply=reply.reply,
        products=[p.product_id for p in reply.products],
        requests=result.usage.requests if result else None,
    )
    return reply


def _reply_from(result) -> ChatReply:
    output = result.output
    # Only show products the tools returned for this message, then build the cards from the
    # database, so a card can never show an invented product or detail.
    looked_up = _looked_up_ids(result.new_messages())
    verified = [pid for pid in output.product_ids if pid in looked_up]
    try:
        cards = product_cards(verified)
    except Exception:
        # The answer is still useful without cards.
        logger.exception("Building product cards failed")
        cards = []
    # An answer given while a lookup failed ("I can't check right now") is shown but not saved.
    return ChatReply(reply=output.reply, products=cards, fallback=_had_tool_failure(result.new_messages()))
