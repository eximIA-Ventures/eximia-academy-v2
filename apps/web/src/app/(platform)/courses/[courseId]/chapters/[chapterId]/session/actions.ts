"use server"

import { issueCertificate } from "@/lib/certificates/generate"
import { createClient } from "@/lib/supabase/server"

export async function updateProgress(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: result } = await supabase.rpc("update_enrollment_progress", {
    p_student_id: user.id,
    p_course_id: courseId,
  })

  // Auto-issue certificate when course is completed
  if (result && result.length > 0 && result[0].new_status === "completed") {
    const enrollmentId = result[0].enrollment_id as string
    issueCertificate(enrollmentId).catch(() => {
      // Silently handle — certificate can be issued later on demand
    })
  }
}
