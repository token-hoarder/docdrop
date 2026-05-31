import os
from functools import lru_cache
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

security = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _supabase() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SECRET_KEY"],
    )


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Returns the Supabase user dict if a valid token is provided, else None."""
    if not credentials:
        return None
    try:
        response = _supabase().auth.get_user(credentials.credentials)
        return response.user
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def require_user(user=Depends(get_current_user)):
    """Dependency that requires a logged-in user. Use on protected endpoints."""
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user
