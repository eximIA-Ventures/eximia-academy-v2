"""Blueprint generation service - orchestrates DIALECTICA"""

from app.models import BlueprintGenerateRequest
from app.services.job_manager import JobManager
from app.services.supabase_client import get_supabase
from datetime import datetime
import json
import subprocess
import sys
import structlog
from pathlib import Path
import uuid

logger = structlog.get_logger(__name__)

job_manager = JobManager()


class BlueprintGenerator:
    """Generates course blueprints using DIALECTICA"""

    def __init__(self):
        """Initialize blueprint generator"""
        # Get path to dialectica package
        self.dialectica_path = Path(__file__).parent.parent.parent / "dialectica"
        self.supabase = get_supabase()

    async def generate(self, job_id: str, request: BlueprintGenerateRequest):
        """
        Generate blueprint for a course.

        This runs in background and updates job status as it progresses.
        """
        try:
            # Create job record
            await job_manager.create_job(
                job_id=job_id,
                course_id=request.course_id,
                tenant_id=request.tenant_id,
                requested_by=request.requested_by,
                request_data=request.model_dump(),
            )

            # Update status: processing
            await job_manager.update_job_status(
                job_id=job_id,
                status="processing",
                progress={
                    "current_phase": "PHASE 1: Analyzing input",
                    "percentage": 10,
                },
            )

            logger.info("blueprint_generation_phase1_started", job_id=job_id)

            # Prepare input for DIALECTICA
            dialectica_input = {
                "course_title": request.course_title,
                "business_goal": request.business_goal,
                "target_audience": {
                    "role": request.target_audience_role,
                    "experience_level": request.experience_level,
                    "prior_knowledge": request.prior_knowledge,
                },
                "constraints": {
                    "total_duration_hours": request.total_duration_hours,
                    "weeks": request.weeks,
                    "hours_per_week": request.hours_per_week,
                    "delivery_mode": request.delivery_mode,
                    "cohort_based": request.cohort_based,
                },
                "preferences": {
                    "learning_style": request.learning_style,
                    "assessment_type": request.assessment_type,
                    "content_density": request.content_density,
                },
            }

            # Call DIALECTICA via subprocess
            blueprint_data = await self._call_dialectica(job_id, dialectica_input)

            # Extract metadata
            framework = blueprint_data.get("analysis", {}).get("framework_mix", {}).get("primary_framework", "Unknown")
            objectives = blueprint_data.get("blueprint", {}).get("objectives", [])
            assessments = blueprint_data.get("blueprint", {}).get("assessments", [])
            bloom_progression = blueprint_data.get("blueprint", {}).get("bloom_progression", [])

            # Create blueprint record in Supabase
            blueprint_id = str(uuid.uuid4())
            try:
                if self.supabase:
                    # Save main blueprint
                    self.supabase.table("course_blueprints").insert({
                        "id": blueprint_id,
                        "course_id": request.course_id,
                        "tenant_id": request.tenant_id,
                        "blueprint_data": blueprint_data,
                        "framework": str(framework),
                        "total_objectives": len(objectives),
                        "total_assessments": len(assessments),
                        "bloom_progression": bloom_progression,
                        "status": "draft",
                    }).execute()

                    # Save objectives (denormalized)
                    for obj in objectives:
                        self.supabase.table("blueprint_objectives").insert({
                            "blueprint_id": blueprint_id,
                            "objective_id": obj.get("objective_id"),
                            "module_number": obj.get("module_number"),
                            "bloom_level": obj.get("bloom_level"),
                            "behavior": obj.get("abcd", {}).get("behavior", ""),
                            "condition": obj.get("abcd", {}).get("condition", ""),
                            "degree": obj.get("abcd", {}).get("degree", ""),
                            "objective_statement": obj.get("objective_statement", ""),
                        }).execute()

                    # Save assessments (denormalized)
                    for assessment in assessments:
                        self.supabase.table("blueprint_assessments").insert({
                            "blueprint_id": blueprint_id,
                            "objective_id": assessment.get("objective_id"),
                            "assessment_type": assessment.get("assessment_type"),
                            "timing": assessment.get("timing"),
                            "format": assessment.get("format"),
                            "rubric_required": assessment.get("rubric_required", False),
                            "estimated_duration_min": assessment.get("estimated_duration_min"),
                        }).execute()

                    logger.info(
                        "blueprint_saved_supabase",
                        blueprint_id=blueprint_id,
                        objectives_count=len(objectives),
                    )
            except Exception as e:
                logger.warning("blueprint_save_supabase_failed", error=str(e))
                # Continue even if Supabase save fails

            # Update status: completed
            await job_manager.update_job_status(
                job_id=job_id,
                status="completed",
                progress={
                    "current_phase": "Completed",
                    "percentage": 100,
                    "objectives_generated": len(objectives),
                    "assessments_generated": len(assessments),
                },
                blueprint_id=blueprint_id,
            )

            logger.info(
                "blueprint_generation_completed",
                job_id=job_id,
                blueprint_id=blueprint_id,
                course_id=request.course_id,
                objectives_count=len(objectives),
                assessments_count=len(assessments),
            )

        except Exception as e:
            logger.error(
                "blueprint_generation_failed",
                job_id=job_id,
                error=str(e),
                exc_info=True,
            )

            await job_manager.update_job_status(
                job_id=job_id,
                status="failed",
                error=str(e),
            )

    async def _call_dialectica(self, job_id: str, input_data: dict) -> dict:
        """
        Call DIALECTICA CLI and return blueprint.

        DIALECTICA is imported as a Python package and called via CLI.
        """
        try:
            # Write input to temp file
            import tempfile
            import os

            with tempfile.NamedTemporaryFile(
                mode="w",
                suffix=".json",
                delete=False,
                dir="/tmp",
            ) as f:
                json.dump(input_data, f)
                input_file = f.name

            output_file = input_file.replace(".json", "_output.json")

            try:
                # Call DIALECTICA via Python subprocess
                logger.info(
                    "dialectica_subprocess_start",
                    job_id=job_id,
                    input_file=input_file,
                    cwd=str(self.dialectica_path),
                )

                result = subprocess.run(
                    [
                        sys.executable,
                        "-m",
                        "dialectica",
                        input_file,
                    ],
                    cwd=str(self.dialectica_path),
                    capture_output=True,
                    text=True,
                    timeout=300,  # 5 minutes timeout
                )

                if result.returncode != 0:
                    logger.error(
                        "dialectica_subprocess_error",
                        job_id=job_id,
                        returncode=result.returncode,
                        stderr=result.stderr,
                        stdout=result.stdout,
                    )
                    raise RuntimeError(
                        f"DIALECTICA failed: {result.stderr}"
                    )

                # Read output
                if not os.path.exists(output_file):
                    logger.error(
                        "dialectica_no_output",
                        job_id=job_id,
                        output_file=output_file,
                        files_in_tmp=os.listdir("/tmp"),
                    )
                    raise RuntimeError("DIALECTICA did not generate output file")

                with open(output_file, "r") as f:
                    blueprint_data = json.load(f)

                logger.info("dialectica_execution_successful", job_id=job_id)
                return blueprint_data

            finally:
                # Cleanup temp files
                for f in [input_file, output_file]:
                    if os.path.exists(f):
                        try:
                            os.remove(f)
                        except Exception as e:
                            logger.warning("temp_file_cleanup_error", error=str(e))

        except subprocess.TimeoutExpired:
            logger.error("dialectica_timeout", job_id=job_id)
            raise RuntimeError("DIALECTICA processing timeout (5 minutes exceeded)")

        except Exception as e:
            logger.error("dialectica_execution_error", job_id=job_id, error=str(e))
            raise
