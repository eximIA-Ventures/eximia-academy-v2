"""Supabase client wrapper"""

from typing import Optional
from supabase import create_client, Client
from app.config import settings
import structlog

logger = structlog.get_logger(__name__)


class SupabaseManager:
    """Manages Supabase connections and operations"""

    _instance: Optional[Client] = None

    @classmethod
    def get_client(cls) -> Optional[Client]:
        """Get or create Supabase client (singleton)"""
        if cls._instance is None:
            if not settings.supabase_url or not settings.supabase_service_key:
                logger.warning(
                    "supabase_not_configured",
                    message="SUPABASE_URL or SUPABASE_SERVICE_KEY not set",
                )
                return None

            cls._instance = create_client(
                settings.supabase_url,
                settings.supabase_service_key,
            )

            logger.info("supabase_client_initialized", url=settings.supabase_url)

        return cls._instance

    @classmethod
    def reset(cls):
        """Reset singleton (for testing)"""
        cls._instance = None


def get_supabase() -> Optional[Client]:
    """Get Supabase client"""
    return SupabaseManager.get_client()
