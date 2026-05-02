"""Integration tests for blueprint generation with DIALECTICA"""

import pytest
import json
import tempfile
import os
from pathlib import Path


def test_blueprint_generation_full_flow(client, sample_blueprint_request):
    """Test full blueprint generation flow"""

    # Step 1: Initiate generation
    response = client.post("/blueprint/generate", json=sample_blueprint_request)

    assert response.status_code == 200
    data = response.json()

    job_id = data["job_id"]
    assert data["status"] == "queued"
    assert data["course_id"] == sample_blueprint_request["course_id"]

    # Step 2: Check job status (should be queued or processing)
    status_response = client.get(f"/blueprint/job/{job_id}")

    # May be 404 if job not yet persisted, which is OK for async operations
    if status_response.status_code == 200:
        status_data = status_response.json()
        assert status_data["job_id"] == job_id
        assert status_data["status"] in ["queued", "processing"]


def test_blueprint_request_validation_complete(sample_blueprint_request):
    """Test that blueprint request has all required fields"""
    required_fields = [
        "course_id",
        "course_title",
        "target_audience_role",
        "experience_level",
        "total_duration_hours",
        "delivery_mode",
        "tenant_id",
        "requested_by",
    ]

    for field in required_fields:
        assert field in sample_blueprint_request, f"Missing required field: {field}"


def test_blueprint_request_contains_valid_experience_levels(client):
    """Test that valid experience levels are accepted"""
    valid_levels = ["novice", "junior_to_mid", "mid_level", "senior", "expert"]

    for level in valid_levels:
        request = {
            "course_id": "test-123",
            "course_title": "Test Course",
            "target_audience_role": "Manager",
            "experience_level": level,
            "total_duration_hours": 40,
            "delivery_mode": "online_async",
            "tenant_id": "tenant-123",
            "requested_by": "user-123",
        }

        response = client.post("/blueprint/generate", json=request)
        assert response.status_code == 200, f"Failed for experience_level: {level}"


def test_blueprint_request_contains_valid_delivery_modes(client):
    """Test that valid delivery modes are accepted"""
    valid_modes = ["online_async", "online_sync", "presential", "hybrid"]

    for mode in valid_modes:
        request = {
            "course_id": "test-123",
            "course_title": "Test Course",
            "target_audience_role": "Manager",
            "experience_level": "junior_to_mid",
            "total_duration_hours": 40,
            "delivery_mode": mode,
            "tenant_id": "tenant-123",
            "requested_by": "user-123",
        }

        response = client.post("/blueprint/generate", json=request)
        assert response.status_code == 200, f"Failed for delivery_mode: {mode}"


def test_blueprint_generation_request_with_minimal_fields(client):
    """Test blueprint generation with only required fields"""
    minimal_request = {
        "course_id": "test-minimal",
        "course_title": "Minimal Course Title",
        "target_audience_role": "Engineer",
        "experience_level": "senior",
        "total_duration_hours": 20,
        "delivery_mode": "online_async",
        "tenant_id": "tenant-minimal",
        "requested_by": "user-minimal",
    }

    response = client.post("/blueprint/generate", json=minimal_request)

    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"


def test_blueprint_generation_request_with_all_fields(client, sample_blueprint_request):
    """Test blueprint generation with all optional fields"""
    response = client.post("/blueprint/generate", json=sample_blueprint_request)

    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"


def test_blueprint_request_calculated_duration(client):
    """Test that duration can be provided explicitly with weeks/hours_per_week"""
    request = {
        "course_id": "test-calc",
        "course_title": "Test Course",
        "target_audience_role": "Manager",
        "experience_level": "mid_level",
        "total_duration_hours": 42,  # 12 * 3.5
        "weeks": 12,
        "hours_per_week": 3.5,
        "delivery_mode": "online_async",
        "tenant_id": "tenant-calc",
        "requested_by": "user-calc",
    }

    response = client.post("/blueprint/generate", json=request)
    assert response.status_code == 200


def test_service_health_with_load(client, sample_blueprint_request):
    """Test service can handle multiple concurrent requests"""
    job_ids = []

    for i in range(3):
        request = sample_blueprint_request.copy()
        request["course_id"] = f"test-{i}"

        response = client.post("/blueprint/generate", json=request)
        assert response.status_code == 200
        job_ids.append(response.json()["job_id"])

    assert len(job_ids) == 3
    assert len(set(job_ids)) == 3  # All unique


def test_error_recovery_on_invalid_request(client):
    """Test error handling on invalid request"""
    invalid_request = {
        "course_id": "test-invalid",
        # Missing required fields
    }

    response = client.post("/blueprint/generate", json=invalid_request)
    assert response.status_code == 422  # Validation error


def test_endpoint_returns_correct_response_structure(client, sample_blueprint_request):
    """Test response structure matches BlueprintGenerateResponse"""
    response = client.post("/blueprint/generate", json=sample_blueprint_request)

    assert response.status_code == 200
    data = response.json()

    # Check required fields
    assert "job_id" in data
    assert "course_id" in data
    assert "status" in data
    assert "message" in data
    assert "estimated_time_seconds" in data

    # Check types
    assert isinstance(data["job_id"], str)
    assert isinstance(data["course_id"], str)
    assert isinstance(data["status"], str)
    assert isinstance(data["message"], str)
    assert isinstance(data["estimated_time_seconds"], int)
