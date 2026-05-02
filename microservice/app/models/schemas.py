"""Pydantic schemas for request/response validation"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class HealthCheckResponse(BaseModel):
    """Health check response"""

    status: str
    version: str
    timestamp: datetime
    environment: str


class BlueprintGenerateRequest(BaseModel):
    """Request to generate a blueprint"""

    course_id: str = Field(..., min_length=1, max_length=50)
    course_title: str = Field(..., min_length=5, max_length=200)
    business_goal: Optional[str] = Field(default=None, max_length=500)
    target_audience_role: str = Field(..., min_length=2, max_length=100)
    experience_level: str = Field(
        ...,
        pattern="^(novice|junior_to_mid|mid_level|senior|expert)$",
    )
    prior_knowledge: list[str] = Field(default_factory=list)
    total_duration_hours: float = Field(..., gt=4, le=500)
    weeks: Optional[int] = Field(default=None, gt=0)
    hours_per_week: Optional[float] = Field(default=None, gt=0)
    delivery_mode: str = Field(
        default="online_async",
        pattern="^(online_async|online_sync|presential|hybrid)$",
    )
    cohort_based: bool = Field(default=True)
    learning_style: str = Field(default="experiential")
    assessment_type: str = Field(default="authentic")
    content_density: str = Field(
        default="lean",
        pattern="^(lean|comprehensive)$",
    )
    tenant_id: str = Field(..., min_length=1)
    requested_by: str = Field(..., min_length=1)


class BlueprintObjective(BaseModel):
    """Learning objective in a blueprint"""

    objective_id: str
    module_number: int
    bloom_level: str
    behavior: str
    condition: str
    degree: str
    objective_statement: str


class BlueprintAssessment(BaseModel):
    """Assessment in a blueprint"""

    objective_id: str
    assessment_type: str
    timing: str
    format: str
    rubric_required: bool
    estimated_duration_min: int


class BlueprintGenerateResponse(BaseModel):
    """Response from blueprint generation request"""

    job_id: str
    course_id: str
    status: str  # "queued" | "processing" | "completed" | "failed"
    message: str
    estimated_time_seconds: int


class JobStatusResponse(BaseModel):
    """Job status response"""

    job_id: str
    course_id: str
    status: str  # "queued" | "processing" | "completed" | "failed"
    progress: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    blueprint_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class ErrorResponse(BaseModel):
    """Error response"""

    status: str = "error"
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
