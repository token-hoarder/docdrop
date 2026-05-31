import re
import logging
from app.db import _supabase

log = logging.getLogger("docdrop")


def get_balance(user_id: str) -> int:
    """Returns current credit balance. O(1) read from credit_balances row."""
    result = _supabase().rpc("get_credit_balance", {"p_user_id": user_id}).execute()
    return result.data or 0


def debit(user_id: str, pages: int, metadata: dict | None = None) -> int:
    """
    Atomically debits `pages` credits from the user's balance.
    Returns new balance. Raises ValueError if insufficient credits.

    Serialized at DB level via SELECT ... FOR UPDATE on the credit_balances row —
    concurrent calls for the same user are queued, not raced.
    """
    try:
        result = _supabase().rpc("debit_credits", {
            "p_user_id": user_id,
            "p_pages": pages,
            "p_metadata": metadata or {},
        }).execute()
        return result.data
    except Exception as exc:
        msg = str(exc)
        if "insufficient_credits" in msg:
            m = re.search(r"have (\d+)", msg)
            balance = int(m.group(1)) if m else 0
            raise ValueError(f"Insufficient credits — need {pages}, have {balance}")
        raise
