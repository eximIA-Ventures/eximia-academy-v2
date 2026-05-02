/**
 * Blueprint Client - Communicate with Blueprint Microservice
 */

import {
  BlueprintGenerateRequest,
  BlueprintGenerateResponse,
  JobStatusResponse,
} from "@/types/blueprint"

const MICROSERVICE_URL = process.env.NEXT_PUBLIC_BLUEPRINT_MICROSERVICE_URL ?? "http://localhost:8000"

export async function generateBlueprint(
  request: BlueprintGenerateRequest,
): Promise<BlueprintGenerateResponse> {
  const response = await fetch(`${MICROSERVICE_URL}/blueprint/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || "Failed to generate blueprint")
  }

  return response.json()
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(`${MICROSERVICE_URL}/blueprint/job/${jobId}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Job not found")
    }
    throw new Error("Failed to get job status")
  }

  return response.json()
}

export async function getBlueprint(blueprintId: string) {
  const response = await fetch(`${MICROSERVICE_URL}/blueprint/${blueprintId}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Blueprint not found")
    }
    throw new Error("Failed to get blueprint")
  }

  return response.json()
}

/**
 * Poll job status until completion
 */
export async function pollJobStatus(
  jobId: string,
  onProgress?: (status: JobStatusResponse) => void,
  maxAttempts = 120, // 10 minutes with 5s interval
  interval = 5000,
): Promise<JobStatusResponse> {
  let attempts = 0

  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      attempts++

      try {
        const status = await getJobStatus(jobId)

        onProgress?.(status)

        if (status.status === "completed" || status.status === "failed") {
          clearInterval(timer)
          resolve(status)
        }

        if (attempts >= maxAttempts) {
          clearInterval(timer)
          reject(new Error("Job polling timeout"))
        }
      } catch (error) {
        if (attempts >= maxAttempts) {
          clearInterval(timer)
          reject(error)
        }
      }
    }, interval)
  })
}
