"use server"

import { createClient } from "@/lib/supabase/server"

export async function updateProgress(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  await supabase.rpc("update_enrollment_progress", {
    p_student_id: user.id,
    p_course_id: courseId,
  })
}
