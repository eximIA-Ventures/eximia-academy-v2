import { getAuthProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { ClosureWizard } from "./closure-wizard"

interface ClosurePageProps {
  params: Promise<{ courseId: string }>
}

export default async function ClosurePage({ params }: ClosurePageProps) {
  const { courseId } = await params
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")

  const supabase = await createClient()

  // Content roles skip closure
  const isContentRole =
    profile.role === "instructor" ||
    profile.role === "manager" ||
    profile.role === "admin" ||
    profile.role === "super_admin"
  if (isContentRole) return redirect(`/courses/${courseId}`)

  // Fetch course
  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .single()

  if (!course) return notFound()

  // Check enrollment is completed
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", user.id)
    .eq("course_id", courseId)
    .single()

  if (!enrollment) return redirect("/courses")
  if (enrollment.status !== "completed") return redirect(`/courses/${courseId}`)

  // Check if post-consciousness already completed
  const { data: postResponse } = await supabase
    .from("consciousness_responses")
    .select("id")
    .eq("enrollment_id", enrollment.id)
    .eq("phase", "post")
    .maybeSingle()

  if (postResponse) {
    // Already completed closure — go to certificate
    return redirect(`/certificates/${enrollment.id}`)
  }

  // Fetch pre-course responses
  const { data: preResponse } = await supabase
    .from("consciousness_responses")
    .select("challenge_text, self_rating, learning_goal")
    .eq("enrollment_id", enrollment.id)
    .eq("phase", "pre")
    .maybeSingle()

  return (
    <ClosureWizard
      courseId={course.id}
      courseTitle={course.title}
      enrollmentId={enrollment.id}
      preResponse={
        preResponse
          ? {
              challengeText: preResponse.challenge_text,
              selfRating: preResponse.self_rating,
              learningGoal: preResponse.learning_goal,
            }
          : null
      }
    />
  )
}
