"""Account creation, login, and sessions for Campus Customs.

Passwords are hashed with salted PBKDF2-SHA256. Two stored formats are supported:
  - "pbkdf2_sha256$<iterations>$<salt>$<hex digest>"  written for new accounts
  - "pbkdf2_sha256$<salt>$<hex digest>"               the format of the supplied accounts,
                                                       which used LEGACY_PBKDF2_ITERATIONS
Password hashes never leave this module: every response uses PublicUser, which has no
password fields.
"""

import hashlib
import hmac
import secrets
import sqlite3
from pathlib import Path

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "campus_customs.db"

PBKDF2_ITERATIONS = 600_000  # OWASP's current recommendation for PBKDF2-SHA256
LEGACY_PBKDF2_ITERATIONS = 120_000  # used by the hashes already in the supplied database
MIN_PASSWORD_LENGTH = 8
SESSION_COOKIE = "cc_session"

# token -> user id. In memory, so everyone is logged out when the server restarts.
_sessions: dict[str, int] = {}

router = APIRouter(prefix="/api/auth")


class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=256)


class LoginRequest(BaseModel):
    email: str
    password: str


class PublicUser(BaseModel):
    id: int
    first_name: str | None
    last_name: str | None
    name: str
    email: str


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _pbkdf2(password: str, salt: str, iterations: int) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations).hex()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${_pbkdf2(password, salt, PBKDF2_ITERATIONS)}"


def verify_password(password: str, stored: str) -> bool:
    parts = stored.split("$")
    if len(parts) == 4 and parts[0] == "pbkdf2_sha256" and parts[1].isdigit():
        _, iterations, salt, digest = parts
        iterations = int(iterations)
    elif len(parts) == 3 and parts[0] == "pbkdf2_sha256":
        _, salt, digest = parts
        iterations = LEGACY_PBKDF2_ITERATIONS
    else:
        return False
    return hmac.compare_digest(_pbkdf2(password, salt, iterations), digest)


# Checked when an email isn't found, so a login takes the same time either way.
_DUMMY_HASH = hash_password(secrets.token_hex(16))


def _public(row: sqlite3.Row) -> PublicUser:
    return PublicUser(
        id=row["id"],
        first_name=row["first_name"],
        last_name=row["last_name"],
        name=row["name"],
        email=row["email"],
    )


def _start_session(response: Response, user_id: int) -> None:
    token = secrets.token_urlsafe(32)
    _sessions[token] = user_id
    # HttpOnly: page scripts can't read the token.
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 7)


@router.post("/register", status_code=201)
def register(body: RegisterRequest, response: Response) -> PublicUser:
    first, last = body.first_name.strip(), body.last_name.strip()
    email = body.email.strip().lower()
    if not first or not last:
        raise HTTPException(422, "First and last name are required.")

    with _connect() as conn:
        if conn.execute("SELECT 1 FROM users WHERE lower(email) = ?", (email,)).fetchone():
            raise HTTPException(409, "An account with that email already exists.")
        try:
            cur = conn.execute(
                "INSERT INTO users (name, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)",
                (f"{first} {last}", email, hash_password(body.password), first, last),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(409, "An account with that email already exists.")
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()

    _start_session(response, row["id"])
    return _public(row)


@router.post("/login")
def login(body: LoginRequest, response: Response) -> PublicUser:
    email = body.email.strip().lower()
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE lower(email) = ?", (email,)).fetchone()

    stored = row["password_hash"] if row else _DUMMY_HASH
    if not verify_password(body.password, stored) or row is None:
        # Same message for unknown email and wrong password.
        raise HTTPException(401, "Incorrect email or password.")

    _start_session(response, row["id"])
    return _public(row)


@router.post("/logout", status_code=204)
def logout(response: Response, cc_session: str | None = Cookie(default=None)) -> None:
    if cc_session:
        _sessions.pop(cc_session, None)
    response.delete_cookie(SESSION_COOKIE)


def current_user(cc_session: str | None = Cookie(default=None)) -> PublicUser | None:
    """FastAPI dependency: the logged-in user from the session cookie, or None."""
    user_id = _sessions.get(cc_session or "")
    if user_id is None:
        return None
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _public(row) if row else None


@router.get("/me")
def me(user: PublicUser | None = Depends(current_user)) -> PublicUser:
    if user is None:
        raise HTTPException(401, "Not logged in.")
    return user
