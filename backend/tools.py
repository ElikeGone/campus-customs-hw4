"""Tools for the Campus Customs chat agent.

Every tool reads live data from data/campus_customs.db (read-only), so product facts in the
agent's replies (descriptions, prices, stock) come from the database rather than the model.
"""

import functools
import json
import logging
import re
import sqlite3
from pathlib import Path
from typing import Literal

from models import (
    MAX_PRODUCT_CARDS,
    ProductCard,
    ProductDetails,
    ProductNotFound,
    ProductSummary,
    SearchResults,
    SizeStock,
    StockCheck,
    ToolFailure,
)

logger = logging.getLogger("campus_customs.tools")

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "campus_customs.db"

SIZES = ["XS", "S", "M", "L", "XL", "XXL"]
SIZE_ALIASES = {
    "xs": "XS", "x-small": "XS", "extra small": "XS", "extra-small": "XS", "xsmall": "XS",
    "s": "S", "small": "S", "sm": "S",
    "m": "M", "medium": "M", "med": "M",
    "l": "L", "large": "L", "lg": "L",
    "xl": "XL", "x-large": "XL", "extra large": "XL", "extra-large": "XL", "xlarge": "XL",
    "xxl": "XXL", "2xl": "XXL", "xx-large": "XXL", "xxlarge": "XXL", "2x": "XXL", "double xl": "XXL",
}
SIZE_ORDER_SQL = "CASE size " + " ".join(f"WHEN '{s}' THEN {i}" for i, s in enumerate(SIZES)) + " ELSE 99 END"
STOPWORDS = {
    "a", "an", "the", "and", "or", "for", "with", "in", "of", "to", "do", "you", "have", "any",
    "yale", "campus", "customs", "i", "me", "my", "is", "are", "some", "want", "looking",
}
MAX_RESULTS = 10


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"\bt[\s-]?shirts?\b", "tshirt", text)
    text = re.sub(r"\bquarter[\s-]?zips?\b|\b1[\s/-]?4[\s-]?zips?\b", "quarterzip", text)
    text = re.sub(r"\bhood(ie|y)?s?\b|\bhooded\b", "hoodie", text)
    text = re.sub(r"\bcrew[\s-]?necks?\b", "crewneck", text)
    text = re.sub(r"\bsweat[\s-]?shirts?\b", "sweatshirt", text)
    text = re.sub(r"\bgr[ae]y\b", "gray", text)
    return re.sub(r"[^a-z0-9]+", " ", text)


def _tokens(text: str) -> list[str]:
    words = []
    for w in _normalize(text).split():
        if w in STOPWORDS:
            continue
        if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]  # simple plural handling: jackets -> jacket
        words.append(w)
    return words


def _summary(row: sqlite3.Row) -> ProductSummary:
    return ProductSummary(
        product_id=row["product_id"],
        name=row["name"],
        garment_type=row["garment_type"],
        price=row["price"],
        colors=json.loads(row["colors"]),
        description=row["description"],
    )


def _normalize_size(size: str) -> str | None:
    key = size.strip().lower()
    return SIZE_ALIASES.get(key) or (key.upper() if key.upper() in SIZES else None)


def _stock_rows(conn: sqlite3.Connection, product_id: str) -> list[SizeStock]:
    rows = conn.execute(
        f"SELECT size, quantity FROM inventory WHERE product_id = ? ORDER BY {SIZE_ORDER_SQL}",
        (product_id,),
    ).fetchall()
    return [SizeStock(size=r["size"], quantity=r["quantity"], in_stock=r["quantity"] > 0) for r in rows]


def _find_product(conn: sqlite3.Connection, product_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id.strip(),)).fetchone()


# How much a query word counts depending on where it appears (the best field wins).
FIELD_WEIGHTS = {"name": 4, "garment_type": 3, "tags": 2, "colors": 2, "description": 1}
DEFAULT_SEARCH_LIMIT = 6


def _field_tokens(row: sqlite3.Row) -> dict[str, set[str]]:
    return {
        "name": set(_tokens(row["name"])),
        "garment_type": set(_tokens(row["garment_type"])),
        "tags": set(_tokens(" ".join(json.loads(row["search_tags"])))),
        "colors": set(_tokens(" ".join(json.loads(row["colors"])))),
        "description": set(_tokens(row["description"])),
    }


def _score(words: list[str], fields: dict[str, set[str]]) -> tuple[int, int]:
    """(number of query words matched, weighted score)."""
    matched, score = 0, 0
    for w in words:
        best = max((weight for field, weight in FIELD_WEIGHTS.items() if w in fields[field]), default=0)
        if best:
            matched += 1
            score += best
    return matched, score


def search_products(
    query: str,
    max_price: float | None = None,
    in_stock_size: str | None = None,
    sort: Literal["relevance", "price_low_to_high", "price_high_to_low"] = "relevance",
    limit: int = DEFAULT_SEARCH_LIMIT,
) -> SearchResults:
    """Search the Campus Customs catalogue for the products that best match a shopper's request.

    Ranks products by how well they match every word of the query, with matches in the product
    name counting most, then garment type, then search tags and colors, then description. Only
    products matching all the words are returned when any exist (exact_match is true); otherwise
    the closest partial matches are returned with exact_match false. Returns the top `limit`
    products plus total_matches, the number of relevant products overall. Use this first to find
    the product_id for any product the shopper mentions.

    Args:
        query: What the shopper is looking for, e.g. "navy hoodie", "Davenport crewneck", "Yale Dad".
            Use "" to match every product.
        max_price: Optional price ceiling in dollars.
        in_stock_size: Optional size (e.g. "XS", "medium"); only return products with that size in stock.
        sort: "relevance" (default), or "price_low_to_high" / "price_high_to_low" for cheapest or
            most expensive questions.
        limit: How many products to return, 1 to 10 (default 6). Use 1 to 3 when the shopper names
            one product.
    """
    limit = max(1, min(int(limit), MAX_RESULTS))
    words = list(dict.fromkeys(_tokens(query)))
    size = _normalize_size(in_stock_size) if in_stock_size else None
    if in_stock_size and size is None:
        return SearchResults(total_matches=0, showing=0, exact_match=False, products=[])  # not a size we carry
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM catalogue").fetchall()
        in_stock_ids = (
            {r[0] for r in conn.execute("SELECT product_id FROM inventory WHERE size = ? AND quantity > 0", (size,))}
            if size
            else None
        )

    scored = []
    for row in rows:
        if max_price is not None and row["price"] > max_price:
            continue
        if in_stock_ids is not None and row["product_id"] not in in_stock_ids:
            continue
        matched, score = _score(words, _field_tokens(row)) if words else (0, 0)
        scored.append((matched, score, row))

    if words:
        best = max((m for m, _, _ in scored), default=0)
        # Keep only the best level of word coverage: every word if possible, otherwise the closest
        # partial matches (and at least half the words), so loose one-word matches are dropped.
        needed = best if best == len(words) else max(best, (len(words) + 1) // 2)
        scored = [s for s in scored if s[0] >= needed and s[0] > 0]
        exact = bool(scored) and best == len(words)
    else:
        exact = True

    if sort == "price_low_to_high":
        scored.sort(key=lambda s: (s[2]["price"], -s[1], s[2]["name"]))
    elif sort == "price_high_to_low":
        scored.sort(key=lambda s: (-s[2]["price"], -s[1], s[2]["name"]))
    else:
        scored.sort(key=lambda s: (-s[1], s[2]["name"]))
    products = [_summary(row) for _, _, row in scored[:limit]]
    return SearchResults(total_matches=len(scored), showing=len(products), exact_match=exact, products=products)


def _not_found(product_id: str) -> ProductNotFound:
    return ProductNotFound(
        product_id=product_id,
        message=f"No product found with product_id '{product_id}'. Use search_products to find it.",
    )


def get_product_details(product_id: str) -> ProductDetails | ProductNotFound:
    """Get the full description, price, colors, and stock for every size of one product.

    Args:
        product_id: The product_id from search_products, e.g. "basic-hoodie-big-yale".
    """
    with _connect() as conn:
        row = _find_product(conn, product_id)
        if row is None:
            return _not_found(product_id)
        stock = _stock_rows(conn, row["product_id"])
    return ProductDetails(
        **_summary(row).model_dump(),
        inventory=stock,
        total_stock=sum(s.quantity for s in stock),
        sizes_in_stock=[s.size for s in stock if s.in_stock],
        sizes_out_of_stock=[s.size for s in stock if not s.in_stock],
    )


def check_stock(product_id: str, size: str | None = None) -> StockCheck | ProductNotFound:
    """Check how many units of a product are in stock, for one size or for all sizes.

    If the shopper names a size, pass it to get the exact quantity for that size and a status of
    "in_stock" or "out_of_stock". Sizes are XS, S, M, L, XL, XXL (words like "medium" or "2XL"
    also work); any other size returns status "size_not_offered".

    Args:
        product_id: The product_id from search_products.
        size: Optional size the shopper asked about.
    """
    with _connect() as conn:
        row = _find_product(conn, product_id)
        if row is None:
            return _not_found(product_id)
        stock = _stock_rows(conn, row["product_id"])
    in_stock_sizes = [s.size for s in stock if s.in_stock]
    base = {"product_id": row["product_id"], "name": row["name"], "price": row["price"], "sizes_in_stock": in_stock_sizes}
    name = row["name"]

    if size is None:
        out = [s.size for s in stock if not s.in_stock]
        message = (
            f"{name}: in stock in {', '.join(in_stock_sizes) or 'no sizes'}"
            + (f"; OUT OF STOCK in {', '.join(out)}." if out else "; all sizes in stock.")
        )
        return StockCheck(**base, requested_size=None, status="all_sizes", sizes=stock, message=message)

    normalized = _normalize_size(size)
    match = next((s for s in stock if s.size == normalized), None)
    if match is None:
        return StockCheck(
            **base, requested_size=size, status="size_not_offered", sizes=stock,
            message=f"{name} doesn't come in size '{size}'. Available sizes: {', '.join(s.size for s in stock)}.",
        )
    if match.in_stock:
        status, message = "in_stock", f"{name} in size {match.size}: {match.quantity} in stock."
    else:
        others = ", ".join(in_stock_sizes) or "none"
        status, message = "out_of_stock", f"{name} in size {match.size}: OUT OF STOCK (0 available). In stock in: {others}."
    return StockCheck(**base, requested_size=match.size, status=status, sizes=[match], message=message)


def find_product_summary(product_id: str) -> ProductSummary | None:
    """Look up one product by id (not an agent tool); used to resolve the page the shopper is on."""
    with _connect() as conn:
        row = _find_product(conn, product_id)
    return _summary(row) if row else None


def _short_description(description: str, limit: int = 110) -> str:
    first = description.split(". ")[0].rstrip(".") + "."
    return first if len(first) <= limit else first[: limit - 1].rsplit(" ", 1)[0] + "…"


def product_cards(product_ids: list[str]) -> list[ProductCard]:
    """Build product cards from the database for the given ids (not an agent tool).

    Unknown ids are skipped and duplicates removed, keeping the given order.
    """
    ids = list(dict.fromkeys(pid.strip() for pid in product_ids))[:MAX_PRODUCT_CARDS]
    if not ids:
        return []
    with _connect() as conn:
        rows = conn.execute(
            f"SELECT * FROM catalogue WHERE product_id IN ({', '.join('?' * len(ids))})", ids
        ).fetchall()
    by_id = {r["product_id"]: r for r in rows}
    return [
        ProductCard(
            product_id=r["product_id"],
            name=r["name"],
            garment_type=r["garment_type"],
            price=r["price"],
            image_url=f"/media/{r['image_file_path']}",
            short_description=_short_description(r["description"]),
        )
        for pid in ids
        if (r := by_id.get(pid)) is not None
    ]


def _fail_safely(tool):
    """If a lookup raises (e.g. the database is locked or missing), return a ToolFailure the
    agent can explain to the shopper instead of crashing the whole chat."""

    @functools.wraps(tool)
    def wrapper(*args, **kwargs):
        try:
            return tool(*args, **kwargs)
        except Exception:
            logger.exception("Tool %s failed", tool.__name__)
            return ToolFailure(message="The product database couldn't be reached. Don't guess; tell the shopper to try again shortly.")

    return wrapper


CATALOGUE_TOOLS = [_fail_safely(t) for t in (search_products, get_product_details, check_stock)]
