"""Tests for blueprint generation endpoints"""

import pytest
import uuid


def test_blueprint_generate_request(client, sample_blueprint_request):
    """Test blueprint generation request"""
    response = client.post("/blueprint/generate", json=sample_blueprint_request)

    assert response.status_code == 200
    data = response.json()

    assert "job_id" in data
    assert data["course_id"] == "test-course-123"
    assert data["status"] == "queued"
    assert data["message"]
    assert data["estimated_time_seconds"] > 0

    # Verify job_id is a valid UUID
    try:
        uuid.UUID(data["job_id"])
    except ValueError:
        pytest.fail("job_id is not a valid UUID")


def test_blueprint_generate_missing_required_field(client):
    """Test blueprint generation with missing required field"""
    invalid_request = {
        "course_id": "test-course-123",
        # Missing required fields
    }

    response = client.post("/blueprint/generate", json=invalid_request)

    assert response.status_code == 422  # Validation error


def test_blueprint_generate_invalid_experience_level(client, sample_blueprint_request):
    """Test blueprint generation with invalid experience level"""
    sample_blueprint_request["experience_level"] = "invalid_level"

    response = client.post("/blueprint/generate", json=sample_blueprint_request)

    assert response.status_code == 422


def test_blueprint_generate_invalid_delivery_mode(client, sample_blueprint_request):
    """Test blueprint generation with invalid delivery mode"""
    sample_blueprint_request["delivery_mode"] = "invalid_mode"

    response = client.post("/blueprint/generate", json=sample_blueprint_request)

    assert response.status_code == 422


def test_blueprint_generate_invalid_duration(client, sample_blueprint_request):
    """Test blueprint generation with invalid duration (< 4 hours)"""
    sample_blueprint_request["total_duration_hours"] = 2

    response = client.post("/blueprint/generate", json=sample_blueprint_request)

    assert response.status_code == 422


def test_get_job_status_nonexistent(client):
    """Test getting status of non-existent job"""
    fake_job_id = str(uuid.uuid4())

    response = client.get(f"/blueprint/job/{fake_job_id}")

    assert response.status_code == 404


def test_get_blueprint_nonexistent(client):
    """Test getting non-existent blueprint"""
    fake_blueprint_id = str(uuid.uuid4())

    response = client.get(f"/blueprint/{fake_blueprint_id}")

    assert response.status_code == 404
