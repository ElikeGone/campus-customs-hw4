# Usability Improvements (Problem 9)

Four improvements: two on the frontend and two in the agent/backend. Each was checked in the running app (React + Vite frontend on port 5173, FastAPI backend started from `backend/` with `uvicorn main:app --reload --port 8000`). The agent's failure paths were also forced directly against the same code.

---

## 1. Product search and filtering on the Products page (frontend)

**What was added** (`frontend/src/pages/Products.tsx`)
- A search box that matches every typed word against each product's name, product type, category, description, and colors (e.g. "navy fencing" finds the Fencing Left Chest Hoodie).
- Filters for **category** (Hoodies, Crewnecks, T-shirts, Quarter-zips, Jackets & fleece, Long sleeve), **size in stock** (XS–XXL), and **maximum price** (under $40 / $60 / $80 / $100), plus **sorting** by name or by price (low to high, high to low).
- A live result count ("Showing 21 of 102 products") and a **Clear filters** button.
- Filters are stored in the URL (e.g. `/products?category=Hoodies&size=XS&sort=price_asc`), so a filtered view can be bookmarked or shared and survives a page reload. The Home page's "Shop by style" chips open the Products page already filtered to that category.
- Supporting backend change: `GET /api/products` now includes a `category` (grouping the catalogue's inconsistent garment types, such as "hoodie", "hooded sweatshirt", and "pullover hoodie") and `sizes_in_stock` for each product.

**Why it helps**
- **Shopper:** instead of scrolling through all 102 products, they can go straight to what fits them, like "hoodies in XS, cheapest first," without asking the chatbot. Filtering by size in stock means they only see items they can actually buy.
- **Business:** shoppers who find the right item faster are more likely to buy it, and a shareable filtered link is easy to send to friends and family. It also takes simple browsing questions off the chatbot, which saves model costs.

**Verified in the running app**
- The Home "Crewnecks" chip opened `?category=Crewnecks` with 29 products. Adding "S in stock" left 22. Both match the database.
- Hoodies + XS in stock + price low to high showed 21 products, starting with the two $45 hoodies. Adding "Under $60" left those 2.
- Searching "bulldog" found 8 products, which matches the database. Opening a filtered URL directly restored every filter control.

---

## 2. Clear loading, empty, and error states (frontend)

**What was added**
- **Loading:** animated placeholder cards on the Products page (8 grey cards) and a placeholder layout on the product detail page, both marked `aria-busy` for screen readers. The animation is turned off for users who prefer reduced motion.
- **Empty:** when nothing matches, the page says why ("No products match "unicorn"", or "No products match "bulldog" with these filters" when the filters are the cause), suggests what to change, and offers a **Clear filters** button.
- **Errors:** if products can't be loaded, the page shows "We couldn't load products" with a short explanation and a **Try again** button, instead of a blank page. The product page separates **not found** ("We couldn't find that product," with a link back to all products) from **temporary errors** ("We couldn't load this product," with Try again).
- **Chat:** failures appear as a clearly styled message instead of "Typing…" hanging, including when the backend is down ("The assistant is unavailable right now…") and when the shopper hits the message rate limit (see #4). Fallback replies from the agent are shown in a separate "notice" style.

**Why it helps**
- **Shopper:** they always know what's happening: content is on its way, nothing matched (and how to fix it), or something broke (and that they can retry). Nothing looks frozen or broken.
- **Business:** fewer shoppers leave because the site looks broken, and a one-click Try again recovers from brief outages without a full reload. Separating "not found" from "error" also avoids telling customers a product is gone when the server was just busy.

**Verified in the running app**
- The 8 placeholder cards appeared while products loaded, including after clicking Try again.
- "unicorn" and "bulldog + T-shirts" showed the matching no-results messages, and Clear filters restored all 102 products.
- With the backend stopped, the Products page and a product page each showed their error message with Try again. After restarting the backend, Try again loaded the page normally.
- `/products/not-a-real-product` showed "We couldn't find that product."
- With the backend stopped, the chat showed an error message and "Typing…" went away.

---

## 3. Ranked and limited product search for the agent (backend)

**What was added** (`search_products` in `backend/tools.py`)
- **Weighted ranking:** each query word scores by where it matches, and the best field wins: product name 4, garment type 3, search tags 2, colors 2, description 1.
- **Relevance filtering:** only products matching *every* query word are returned when any exist. Otherwise the tool returns the closest partial matches (covering at least half the words) and sets `exact_match: false`, and the prompt tells the agent to present those as alternatives. Loose one-word matches are no longer included.
- **Result limit:** a `limit` parameter, 6 by default and capped at 10. The prompt tells the agent to use 1–3 when the shopper names a specific product. `total_matches` now counts only relevant products, so the agent's "Here are 10 of our 25…" is accurate.

**Why it helps**
- **Shopper:** answers and product cards focus on what they asked for. A search for one named product now returns that product instead of dozens of loosely related ones.
- **Business:** fewer products per tool result means smaller model inputs and faster, cheaper replies, and more accurate recommendations mean fewer abandoned chats.

**Before and after** (number of products the search tool treated as matches)

| Query | Before | After |
|---|---|---|
| "Davenport College Crewneck" | 96 | 1 |
| "navy hoodie" | 82 | 25 |
| "Yale Dad t-shirt" | 27 | 1 |
| "Berkeley quarter zip" | 13 | 1 |
| "unicorn hoodie" | — | 27 closest hoodies, `exact_match: false` |

**Verified in the running app** (through `POST /api/chat`)
- "Do you have the Davenport College Crewneck?" returned exactly 1 card, with the correct price ($58.00) and stock.
- "Show me navy hoodies" returned "Here are 10 of our 25 navy hoodies" with 10 cards.
- "Do you have a unicorn hoodie?" replied that there's no exact match and offered 6 of the 27 closest hoodies.

---

## 4. Limits on model/tool calls and graceful failure handling (backend)

**What was added** (`backend/agent.py`, `backend/tools.py`, `backend/main.py`)
- **Per-message limits:** at most 6 model requests, 8 tool calls, and 80,000 tokens for each shopper message (PydanticAI `UsageLimits`), and a 60-second limit on the whole agent run. The retry budget is 1 for invalid tool arguments and 2 for an invalid structured answer. The prompt also tells the agent to be efficient (usually one search plus one or two lookups).
- **Per-shopper rate limit:** at most 10 chat messages per 60 seconds for each logged-in user, or each IP address for guests. Beyond that, the API returns HTTP 429 with "You're sending messages quickly. Please wait a minute and try again."
- **Tools can't crash the chat:** if a database lookup raises, the tool returns a structured `ToolFailure` (`ok: false`), and the agent tells the shopper it can't check right now instead of guessing.
- **Helpful fallback replies:** `agent.chat` never raises. Hitting a usage limit, timing out, a model/provider error, a blocked message, or any unexpected error each produces a specific, friendly reply that points to the Products page, marked `fallback: true`. Fallback replies (and answers given while a tool failed) are **not saved** to a logged-in shopper's chat history, so a failed or blocked message isn't replayed to the agent on later turns.

**Why it helps**
- **Shopper:** they always get a useful answer or a clear next step, never a crash or an endless "Typing…".
- **Business:** model costs per message and per shopper are capped, so one confusing question or a runaway script can't run up large bills. Outages are handled gracefully and steer shoppers to the Products page instead of losing them, and chat histories stay clean.

**Verified**
- **Rate limit (running app):** of 9 guest messages sent at once, after 3 earlier messages that minute, exactly 7 got HTTP 200 and 2 got HTTP 429 with the message above. The website chat then showed that message.
- **Model unavailable (running app):** a second backend instance pointed at an unreachable model endpoint answered `POST /api/chat` with HTTP 200 and the "Sorry, I'm having trouble right now… the Products page lets you search and filter everything we carry" fallback (`fallback: true`).
- **Forced failures (same code, run directly):**
  - With `request_limit=1`, a stock question returned the "couldn't pin that down in our catalogue" fallback.
  - A 0.05-second run limit returned the "took longer than expected" fallback.
  - Pointing the tools at a missing database made the agent reply that it couldn't check the price right now, with no product cards.
- **Normal usage stays well within the limits:** "Do you have the Davenport College Crewneck?" used 3 model requests and 2 tool calls, and the category searches used 2 requests and 1 tool call.
- **History:** with a temporary copy of the database, a normal reply added 2 rows to `chat_messages`, and a fallback reply added none.
