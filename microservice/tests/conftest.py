"""Pytest configuration and fixtures"""

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def sample_blueprint_request():
    """Sample blueprint generation request"""
    return {
        "course_id": "test-course-123",
        "course_title": "Product Management Fundamentals",
        "business_goal": "Reduzir time-to-market melhorando decisões de PM",
        "target_audience_role": "Product Managers",
        "experience_level": "junior_to_mid",
        "prior_knowledge": ["basic agile", "basic UX"],
        "total_duration_hours": 40,
        "weeks": 12,
        "hours_per_week": 3.5,
        "delivery_mode": "online_async",
        "cohort_based": True,
        "learning_style": "experiential",
        "assessment_type": "authentic",
        "content_density": "lean",
        "tenant_id": "tenant-123",
        "requested_by": "user-123",
    }
