"""Job management for blueprint generation"""

from datetime import datetime
from typing import Optional, Dict, Any
import structlog
from app.services.supabase_client import get_supabase

logger = structlog.get_logger(__name__)


class JobManager:
    """Manages job state and persistence with Supabase fallback"""

    def __init__(self):
        """Initialize job manager"""
        self.supabase = get_supabase()
        # In-memory fallback when Supabase is not available
        self.jobs: Dict[str, Dict[str, Any]] = {}

    async def create_job(
        self,
        job_id: str,
        course_id: str,
        tenant_id: str,
        requested_by: str,
        request_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """Create a new job record in Supabase or memory"""
        try:
            if self.supabase:
                # Try to create in Supabase
                response = self.supabase.table("blueprint_generation_jobs").insert({
                    "id": job_id,
                    "course_id": course_id,
                    "tenant_id": tenant_id,
                    "status": "queued",
                    "progress": {"current_phase": "queued", "percentage": 0},
                    "requested_by": requested_by,
                }).execute()

                logger.info(
                    "job_created_supabase",
                    job_id=job_id,
                    course_id=course_id,
                )
                return job_id

        except Exception as e:
            logger.warning(
                "job_creation_supabase_failed",
                error=str(e),
                fallback="memory",
            )

        # Fallback to in-memory
        self.jobs[job_id] = {
            "job_id": job_id,
            "course_id": course_id,
            "tenant_id": tenant_id,
            "status": "queued",
            "progress": {"current_phase": "queued", "percentage": 0},
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "blueprint_data": None,
            "error": None,
        }

        logger.info(
            "job_created_memory",
            job_id=job_id,
            course_id=course_id,
        )
        return job_id

    async def update_job_status(
        self,
        job_id: str,
        status: str,
        progress: Optional[Dict[str, Any]] = None,
        blueprint_id: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        """Update job status in Supabase or memory"""
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat(),
        }

        if progress is not None:
            update_data["progress"] = progress

        if blueprint_id is not None:
            update_data["blueprint_id"] = blueprint_id

        if error is not None:
            update_data["error_message"] = error

        if status == "completed":
            update_data["completed_at"] = datetime.utcnow().isoformat()
        elif status == "processing":
            update_data["started_at"] = datetime.utcnow().isoformat()

        try:
            if self.supabase:
                # Try to update in Supabase
                self.supabase.table("blueprint_generation_jobs").update(
                    update_data
                ).eq("id", job_id).execute()

                logger.info(
                    "job_status_updated_supabase",
                    job_id=job_id,
                    status=status,
                )
                return

        except Exception as e:
            logger.warning(
                "job_update_supabase_failed",
                job_id=job_id,
                error=str(e),
                fallback="memory",
            )

        # Fallback to in-memory
        if job_id not in self.jobs:
            logger.warning("job_not_found_for_update", job_id=job_id)
            return

        self.jobs[job_id].update(update_data)

        logger.info(
            "job_status_updated_memory",
            job_id=job_id,
            status=status,
        )

    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status from Supabase or memory"""
        try:
            if self.supabase:
                # Try to get from Supabase
                response = self.supabase.table("blueprint_generation_jobs").select(
                    "*"
                ).eq("id", job_id).single().execute()

                if response.data:
                    return response.data

        except Exception as e:
            logger.debug("job_status_supabase_failed", job_id=job_id, error=str(e))

        # Fallback to in-memory
        job = self.jobs.get(job_id)
        if job:
            return {
                "job_id": job["job_id"],
                "course_id": job["course_id"],
                "status": job["status"],
                "progress": job.get("progress", {}),
                "created_at": job.get("created_at"),
                "updated_at": job.get("updated_at"),
                "blueprint_data": job.get("blueprint_data"),
                "error": job.get("error"),
            }

        return None

    async def get_blueprint(self, blueprint_id: str) -> Optional[Dict[str, Any]]:
        """Get blueprint by ID from Supabase or memory"""
        try:
            if self.supabase:
                # Try to get from Supabase
                response = self.supabase.table("course_blueprints").select(
                    "*"
                ).eq("id", blueprint_id).single().execute()

                if response.data:
                    return response.data.get("blueprint_data")

        except Exception as e:
            logger.debug("get_blueprint_supabase_failed", blueprint_id=blueprint_id, error=str(e))

        # Fallback to in-memory (check if blueprint_id matches a job)
        for job in self.jobs.values():
            if job.get("blueprint_data"):
                return job["blueprint_data"]

        return None
