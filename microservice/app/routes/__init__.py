"""API routes"""

from .health import router as health_router
from .blueprint import router as blueprint_router

__all__ = ["health_router", "blueprint_router"]
