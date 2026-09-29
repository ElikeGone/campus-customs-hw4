"""Pydantic models for the Campus Customs chat API."""

from typing import Literal

from pydantic import BaseModel, Field

MAX_MESSAGE_LENGTH = 2000


class PageContext(BaseModel):
    """Where the shopper is on the site when they send a message.

    Only identifiers are accepted from the browser; the backend looks up the real product.
    """

    path: str = Field(default="/", max_length=300)
    # Set when the shopper is on /products/<product_id>.
    product_id: str | None = Field(default=None, max_length=200)


class ChatRequest(BaseModel):
    """A shopper's message from the website chat widget."""

    message: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)
    page: PageContext | None = None


MAX_PRODUCT_CARDS = 10


class ProductCard(BaseModel):
    """A compact product summary the website shows as a card alongside a chat reply.

    Built by the backend from campus_customs.db (never by the model), so a card always shows
    real catalogue data and links to /products/<product_id>.
    """

    product_id: str
    name: str
    garment_type: str
    price: float
    image_url: str
    # First sentence of the catalogue description, trimmed for a small card.
    short_description: str


class AgentReply(BaseModel):
    """The agent's structured output: text for the chat plus which products to show as cards."""

    reply: str = Field(description="The chat message to show the shopper, in plain text.")
    product_ids: list[str] = Field(
        default_factory=list,
        max_length=MAX_PRODUCT_CARDS,
        description=(
            "product_id values, copied exactly from tool results in this conversation, for the "
            "products to show as cards, most relevant first. Empty if no products should be shown."
        ),
    )


# ---- Tool results (see tools.py). Values come straight from campus_customs.db. ----


class ProductSummary(BaseModel):
    """One search result: enough for the agent to pick the right product."""

    product_id: str
    name: str
    garment_type: str
    price: float
    # Colors that appear on this one item (e.g. garment and graphic), not separate color options.
    colors: list[str]
    description: str


class SearchResults(BaseModel):
    """search_products result: the top matches plus how many products matched in total."""

    total_matches: int
    showing: int
    # False when no product matched every word, so these are only the closest partial matches.
    exact_match: bool
    products: list[ProductSummary]


class SizeStock(BaseModel):
    size: str
    quantity: int
    in_stock: bool


class ProductDetails(ProductSummary):
    """Full product record including stock for every size."""

    inventory: list[SizeStock]
    total_stock: int
    sizes_in_stock: list[str]
    sizes_out_of_stock: list[str]


StockStatus = Literal["in_stock", "out_of_stock", "size_not_offered", "all_sizes"]


class StockCheck(BaseModel):
    """Answer to a stock question, for one size or for all sizes."""

    product_id: str
    name: str
    price: float
    requested_size: str | None
    # in_stock / out_of_stock for a requested size, size_not_offered for an unknown size,
    # or all_sizes when no size was asked for.
    status: StockStatus
    # The requested size (if valid), otherwise every size.
    sizes: list[SizeStock]
    # Every size with stock, so an out-of-stock answer can suggest alternatives.
    sizes_in_stock: list[str]
    message: str


class ToolFailure(BaseModel):
    """Returned by a tool when the lookup itself failed (e.g. the database was unavailable)."""

    ok: Literal[False] = False
    message: str


class ProductNotFound(BaseModel):
    """Returned instead of a product when a product_id doesn't exist."""

    found: Literal[False] = False
    product_id: str
    message: str


class ChatReply(BaseModel):
    """What /api/chat returns to the frontend."""

    reply: str
    # Cards for the products the agent recommended, filled from the database.
    products: list[ProductCard] = Field(default_factory=list)
    # True when this is a canned reply because the agent failed, timed out, hit its limits, or
    # the message was blocked. Fallback exchanges aren't saved to chat history.
    fallback: bool = False


# ---- Saved chat history (chat_messages table) ----


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = Field(default_factory=list)
    created_at: str


class ChatHistory(BaseModel):
    """The logged-in shopper's own saved conversation, oldest first."""

    messages: list[ChatHistoryMessage]
