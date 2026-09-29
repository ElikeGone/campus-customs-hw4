# Campus Customs: Shop and AI Shopping Assistant (HW4)

A Campus Customs storefront (React + Vite + TypeScript) with a FastAPI backend and a PydanticAI shopping assistant. The assistant answers product, price, and stock questions from the real catalogue, shows matching products as cards, remembers logged-in shoppers, and records every run in `output/audit_trail.json`.

For the full system description, see [`output/harness.md`](output/harness.md).

## Requirements

- Python 3.12+ (developed on 3.14)
- Node.js 20+ and npm (developed on Node 24)
- A Portkey API key (or an OpenAI key) for the chat assistant

## 1. Place the local data pack

The database and product photos are not committed. Unzip the course data pack (`data.zip`) into the project root so that you have:

```
hw4/
└── data/
    ├── campus_customs.db     # catalogue, inventory, users, chat_messages
    └── products/             # product photos (*.jpg)
```

From the `hw4` folder:
```bash
unzip data.zip
```
(or extract it with your file manager). The backend reads `data/campus_customs.db` and `data/products/` relative to the project, so no path configuration is needed.

## 2. Set environment variables

Copy the example file and add your key:
```bash
cp .env.example .env
```
| Variable | Purpose | Default |
|---|---|---|
| `PORTKEY_API_KEY` | Portkey gateway key (required for the chat assistant) | none |
| `PORTKEY_BASE_URL` | Portkey endpoint | `https://api.portkey.ai/v1` |
| `PORTKEY_PROVIDER` | Provider behind Portkey | `openai` |
| `CHAT_MODEL` | Model name | `gpt-5.6-luna` |

The values can also be set as regular environment variables instead of using `.env`. Never commit `.env` (it's in `.gitignore`). If `PORTKEY_API_KEY` is not set, the agent falls back to calling OpenAI directly with `OPENAI_API_KEY`. The shop, login, and product pages work without any key; only the chat needs one.

## 3. Run the backend (FastAPI, port 8000)

From the `hw4` folder, create a virtual environment and install dependencies:
```bash
python -m venv .venv
```
Activate it (Windows Git Bash: `source .venv/Scripts/activate`, PowerShell: `.venv\Scripts\Activate.ps1`, macOS/Linux: `source .venv/bin/activate`), then:
```bash
pip install -r requirements.txt
```
Start the API from inside `backend/`:
```bash
cd backend
uvicorn main:app --reload --port 8000
```

## 4. Run the frontend (React + Vite, port 5173)

In a second terminal, from the `hw4` folder:
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**. The Vite dev server forwards `/api` and `/media` requests to the backend on port 8000, so both servers must be running.

## Try it

- **Shop:** search, filter by category, size in stock, or price, and sort.
- **Log in:** use the test account supplied with the data pack, or create an account.
- **Chat:** click **Ask us** and try "What hoodies do you have?" or, on a product page, "Is this in stock in medium?"

## Project layout

```
hw4/
├── AI_prompts.md            # prompts used for each problem
├── README.md
├── requirements.txt         # backend Python dependencies
├── .env.example             # environment variable placeholders
├── backend/
│   ├── main.py              # FastAPI app and routes
│   ├── agent.py             # PydanticAI agent, limits, fallbacks, audit hook
│   ├── tools.py             # database lookup tools
│   ├── models.py            # Pydantic models
│   ├── prompts/prompt.md    # system prompt and safety rules
│   ├── auth.py              # accounts and sessions
│   ├── chat_history.py      # saved chats for logged-in shoppers
│   ├── audit.py             # append-only audit trail
│   └── product_images.py    # white-background product photos
├── frontend/                # React + Vite + TypeScript storefront
├── data/                    # local data pack (not committed)
└── output/
    ├── harness.md           # full system description
    ├── usability.md         # Problem 9 usability improvements
    ├── design.md            # Problem 10 design changes
    ├── app_check.html       # Problem 11 live app check (open in a browser)
    ├── app_check_images/    # screenshots used by app_check.html
    └── audit_trail.json     # append-only agent run log
```
