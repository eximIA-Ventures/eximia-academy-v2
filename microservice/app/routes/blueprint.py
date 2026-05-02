"""Blueprint generation endpoints"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from app.models import (
    BlueprintGenerateRequest,
    BlueprintGenerateResponse,
    JobStatusResponse,
    ErrorResponse,
)
from app.services.blueprint_generator import BlueprintGenerator
from app.services.job_manager import JobManager
import uuid
import structlog

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/blueprint", tags=["blueprint"])


# Initialize services
blueprint_generator = BlueprintGenerator()
job_manager = JobManager()


@router.post("/generate", response_model=BlueprintGenerateResponse)
async def generate_blueprint(
    request: BlueprintGenerateRequest,
    background_tasks: BackgroundTasks,
):
    """
    Initiate blueprint generation for a course.

    Returns job_id for polling status.
    """
    try:
        # Create job record
        job_id = str(uuid.uuid4())

        # Add background task to process blueprint
        background_tasks.add_task(
            blueprint_generator.generate,
            job_id=job_id,
            request=request,
        )

        logger.info(
            "blueprint_generation_started",
            job_id=job_id,
            course_id=request.course_id,
            tenant_id=request.tenant_id,
            duration_hours=request.total_duration_hours,
        )

        return BlueprintGenerateResponse(
            job_id=job_id,
            course_id=request.course_id,
            status="queued",
            message=f"Blueprint generation queued. Job ID: {job_id}",
            estimated_time_seconds=60,
        )

    except Exception as e:
        logger.error("blueprint_generation_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to initiate blueprint generation")


@router.get("/job/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Get status of a blueprint generation job.
    """
    try:
        job_status = await job_manager.get_job_status(job_id)

        if not job_status:
            raise HTTPException(status_code=404, detail="Job not found")

        return JobStatusResponse(**job_status)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("job_status_error", job_id=job_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve job status")


@router.get("/{blueprint_id}")
async def get_blueprint(blueprint_id: str):
    """
    Retrieve a generated blueprint by ID.
    """
    try:
        blueprint = await job_manager.get_blueprint(blueprint_id)

        if not blueprint:
            raise HTTPException(status_code=404, detail="Blueprint not found")

        return blueprint

    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_blueprint_error", blueprint_id=blueprint_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve blueprint")
