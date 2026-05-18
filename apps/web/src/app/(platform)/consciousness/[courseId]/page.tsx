import { getAuthProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { ConsciousnessWizardPage } from "./consciousness-wizard-page"

interface ConsciousnessPageProps {
  params: Promise<{ courseId: string }>
}

export default async function ConsciousnessPage({ params }: ConsciousnessPageProps) {
  const { courseId } = await params
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")

  const supabase = await createClient()

  // Content roles skip consciousness
  if (["instructor", "manager", "admin", "super_admin"].includes(profile.role)) {
    return redirect(`/courses/${courseId}`)
  }

  const { data: course } = await supabase.from("courses").select("id, title, description").eq("id", courseId).single()
  if (!course) return notFound()

  const { data: enrollment } = await supabase.from("enrollments").select("id").eq("student_id", user.id).eq("course_id", courseId).in("status", ["active", "completed"]).single()
  if (!enrollment) return redirect("/courses")

  const { data: existing } = await supabase.from("consciousness_responses").select("id").eq("enrollment_id", enrollment.id).eq("phase", "pre").maybeSingle()
  if (existing) return redirect(`/courses/${courseId}`)

  return <ConsciousnessWizardPage courseId={course.id} courseTitle={course.title} courseDescription={course.description} />
}
