/**
 * Blueprint Generator Component
 * UI for generating course blueprints
 */

"use client"

import { useState } from "react"
import { Button } from "@eximia/ui"
import { generateBlueprint, pollJobStatus } from "@/lib/blueprint-client"
import { Blueprint, BlueprintGenerateRequest, JobStatusResponse } from "@/types/blueprint"

interface BlueprintGeneratorProps {
  courseId: string
  courseTitle: string
  tenantId: string
  onSuccess?: (blueprint: Blueprint) => void
  onError?: (error: Error) => void
}

export function BlueprintGenerator({
  courseId,
  courseTitle,
  tenantId,
  onSuccess,
  onError,
}: BlueprintGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<JobStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    try {
      setIsLoading(true)
      setError(null)
      setProgress(null)

      const request: BlueprintGenerateRequest = {
        course_id: courseId,
        course_title: courseTitle,
        target_audience_role: "Product Manager",
        experience_level: "junior_to_mid",
        total_duration_hours: 40,
        delivery_mode: "online_async",
        tenant_id: tenantId,
        requested_by: "current-user",
      }

      // Generate blueprint
      const response = await generateBlueprint(request)

      // Poll for completion
      const finalStatus = await pollJobStatus(
        response.job_id,
        (status) => {
          setProgress(status)
        },
      )

      if (finalStatus.status === "completed" && finalStatus.blueprint_data) {
        onSuccess?.(finalStatus.blueprint_data)
      } else if (finalStatus.status === "failed") {
        throw new Error(finalStatus.error || "Blueprint generation failed")
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error.message)
      onError?.(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button
        onClick={handleGenerate}
        disabled={isLoading}
        variant="default"
      >
        {isLoading ? "Generating Blueprint..." : "Generate Blueprint"}
      </Button>

      {progress && (
        <div className="rounded-lg bg-cerrado-600/10 p-4">
          <p className="text-sm font-medium text-text-primary">
            {progress.progress?.current_phase || "Processing"}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
            <div
              className="h-full bg-cerrado-600 transition-all"
              style={{
                width: `${progress.progress?.percentage || 0}%`,
              }}
            />
          </div>
          {progress.progress?.objectives_generated !== undefined && (
            <p className="mt-2 text-xs text-text-muted">
              {progress.progress.objectives_generated} objectives generated
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-semantic-error/10 p-4 text-sm text-semantic-error">
          {error}
        </div>
      )}
    </div>
  )
}
