"""Health check endpoint"""

from fastapi import APIRouter
from datetime import datetime
from app.config import settings
from app.models import HealthCheckResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthCheckResponse)
async def health_check():
    """Health check endpoint"""
    return HealthCheckResponse(
        status="healthy",
        version=settings.service_version,
        timestamp=datetime.utcnow(),
        environment=settings.environment,
    )
