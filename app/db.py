import os
import logging
from functools import lru_cache
from supabase import create_client, Client

log = logging.getLogger("docdrop")


@lru_cache(maxsize=1)
def _supabase() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SECRET_KEY"],
    )


def log_conversion(
    *,
    user_id: str | None,
    filename: str,
    file_ext: str,
    file_size_bytes: int,
    ocr_engine: str | None,
    ocr_used: bool,
    page_count: int | None,
    char_count: int,
    word_count: int,
    duration_ms: int,
):
    try:
        _supabase().table("conversions").insert({
            "user_id": user_id,
            "filename": filename,
            "file_ext": file_ext,
            "file_size_bytes": file_size_bytes,
            "ocr_engine": ocr_engine if ocr_used else None,
            "ocr_used": ocr_used,
            "page_count": page_count,
            "char_count": char_count,
            "word_count": word_count,
            "duration_ms": duration_ms,
        }).execute()
    except Exception as exc:
        # Never let a logging failure break a conversion
        log.warning("Failed to log conversion metadata: %s", exc)
