import logging
from app.db import _supabase

log = logging.getLogger("docdrop")


def get_balance(user_id: str) -> int:
    """Returns current OCR credit balance for a user."""
    result = _supabase().rpc("get_credit_balance", {"p_user_id": user_id}).execute()
    return result.data or 0


def debit(user_id: str, pages: int, metadata: dict | None = None) -> int:
    """
    Deducts `pages` credits from user's balance.
    Returns the new balance. Raises ValueError if insufficient credits.
    """
    balance = get_balance(user_id)
    if balance < pages:
        raise ValueError(f"Insufficient credits — need {pages}, have {balance}")

    _supabase().table("ocr_transactions").insert({
        "user_id": user_id,
        "delta": -pages,
        "reason": "ocr_pages",
        "metadata": metadata or {},
    }).execute()

    return balance - pages
