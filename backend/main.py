"""Campus Customs API: serves the product catalogue and inventory from data/campus_customs.db,
plus account creation and login (see auth.py), the chat agent (see agent.py), and saved chat
history for logged-in shoppers (see chat_history.py)."""

import json
import logging
import sqlite3
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

import agent
import chat_history
import product_images
from auth import MIN_PASSWORD_LENGTH, PublicUser, current_user, router as auth_router
from models import MAX_MESSAGE_LENGTH, ChatHistory, ChatReply, ChatRequest

logger = logging.getLogger("campus_customs")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DATA_DIR / "campus_customs.db"

@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Prepare white-background product photos in the background; requests never wait on this.
    threading.Thread(target=product_images.warm_cache, daemon=True).start()
    yield


app = FastAPI(title="Campus Customs API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    allow_credentials=True,
)
app.include_router(auth_router)

VALIDATION_MESSAGES = {
    "first_name": "Please enter your first name.",
    "last_name": "Please enter your last name.",
    "email": "Please enter a valid email address.",
    "password": f"Password must be at least {MIN_PASSWORD_LENGTH} characters.",
    "message": f"Please enter a message (up to {MAX_MESSAGE_LENGTH} characters).",
}


@app.exception_handler(RequestValidationError)
def validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    # FastAPI's default 422 body echoes the submitted input, which could include a password.
    # Return only a friendly message instead.
    errors = exc.errors()
    if any(e["type"] == "missing" for e in errors):
        return JSONResponse(status_code=422, content={"detail": "Please fill in all required fields."})
    field = next((e["loc"][-1] for e in errors if e.get("loc")), None)
    return JSONResponse(status_code=422, content={"detail": VALIDATION_MESSAGES.get(field, "Invalid request.")})


# image_file_path is relative to data/ (e.g. "products/foo.jpg" -> "/media/products/foo.jpg").
# Only product photos are served (never the database file), as web-ready copies with a white
# background (see product_images.py).
@app.get("/media/products/{filename}", include_in_schema=False)
def product_image(filename: str) -> FileResponse:
    source = product_images.source_path(filename)
    if source is None:
        raise HTTPException(404, "Image not found")
    return FileResponse(
        product_images.web_image(source), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=3600"}
    )


def get_db() -> sqlite3.Connection:
    # Read-only: the catalogue endpoints never write. Account writes live in auth.py.
    conn = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


# Shopper-facing categories for the Products page filter. garment_type values in the catalogue
# are inconsistent ("hoodie", "hooded sweatshirt", "pullover hoodie"...), so group them here.
CATEGORY_RULES = [
    ("Quarter-zips", ("quarter-zip", "1/4 zip")),
    ("Hoodies", ("hood",)),
    ("Jackets & fleece", ("jacket", "fleece")),
    ("T-shirts", ("t-shirt", "tee")),
    ("Long sleeve", ("long-sleeve", "long sleeve")),
    ("Crewnecks", ("crewneck", "crew-neck", "sweatshirt", "mockneck")),
]


def category_for(garment_type: str) -> str:
    g = garment_type.lower()
    return next((cat for cat, keys in CATEGORY_RULES if any(k in g for k in keys)), "Other")


def product_from_row(row: sqlite3.Row) -> dict:
    return {
        "product_id": row["product_id"],
        "name": row["name"],
        "garment_type": row["garment_type"],
        "category": category_for(row["garment_type"]),
        "description": row["description"],
        "colors": json.loads(row["colors"]),
        "image_url": f"/media/{row['image_file_path']}",
        "price": row["price"],
    }


SIZE_ORDER = "CASE size WHEN 'XS' THEN 0 WHEN 'S' THEN 1 WHEN 'M' THEN 2 WHEN 'L' THEN 3 WHEN 'XL' THEN 4 WHEN 'XXL' THEN 5 ELSE 6 END"


@app.get("/api/products")
def list_products() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
        in_stock: dict[str, list[str]] = defaultdict(list)
        for r in conn.execute(f"SELECT product_id, size FROM inventory WHERE quantity > 0 ORDER BY {SIZE_ORDER}"):
            in_stock[r["product_id"]].append(r["size"])
    return [{**product_from_row(r), "sizes_in_stock": in_stock[r["product_id"]]} for r in rows]


@app.get("/api/products/{product_id}")
def get_product(product_id: str) -> dict:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        stock = conn.execute(
            f"SELECT size, quantity FROM inventory WHERE product_id = ? ORDER BY {SIZE_ORDER}",
            (product_id,),
        ).fetchall()
    product = product_from_row(row)
    product["inventory"] = [{"size": s["size"], "quantity": s["quantity"]} for s in stock]
    product["total_stock"] = sum(s["quantity"] for s in stock)
    return product


@app.get("/api/chat/history")
def get_chat_history(user: PublicUser | None = Depends(current_user)) -> ChatHistory:
    # Always the session's own user: there is no way to ask for someone else's history.
    if user is None:
        return ChatHistory(messages=[])
    return ChatHistory(messages=chat_history.load_history(user.id))


# Per-shopper chat rate limit (in memory): stops one browser from triggering a flood of model calls.
CHAT_RATE_LIMIT = 10  # messages
CHAT_RATE_WINDOW_SECONDS = 60
_recent_chats: dict[str, deque[float]] = defaultdict(deque)


def _rate_limited(key: str) -> bool:
    now = time.monotonic()
    times = _recent_chats[key]
    while times and now - times[0] > CHAT_RATE_WINDOW_SECONDS:
        times.popleft()
    if len(times) >= CHAT_RATE_LIMIT:
        return True
    times.append(now)
    return False


@app.post("/api/chat")
async def chat(
    body: ChatRequest, request: Request, user: PublicUser | None = Depends(current_user)
) -> ChatReply:
    message = body.message.strip()
    if not message:
        raise HTTPException(422, VALIDATION_MESSAGES["message"])
    key = f"user:{user.id}" if user else f"ip:{request.client.host if request.client else 'unknown'}"
    if _rate_limited(key):
        raise HTTPException(429, "You're sending messages quickly. Please wait a minute and try again.")
    deps = agent.build_deps(user, body.page)
    history = chat_history.agent_history(user.id) if user else None
    try:
        reply = await agent.chat(message, deps, history, user_id=user.id if user else None)
    except Exception:
        # agent.chat handles its own failures; this is a last-resort guard.
        logger.exception("Chat agent failed")
        raise HTTPException(503, "Sorry, the assistant is unavailable right now. Please try again in a moment.")
    # Only real answers are remembered; fallbacks (errors, timeouts, blocked messages) are not,
    # so a blocked or failed message isn't replayed to the agent on every later turn.
    if user and not reply.fallback:
        chat_history.save_exchange(user.id, message, reply)
    return reply
