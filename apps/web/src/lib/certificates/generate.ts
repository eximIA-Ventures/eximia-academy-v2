import { createServiceClient } from "@/lib/supabase/service"

export interface CertificateData {
  studentName: string
  courseTitle: string
  instructorName: string | null
  workloadHours: number
  issuedAt: string
  verificationCode: string
  tenantName: string
}

const LEVEL_XP = [0, 500, 1500, 3000, 5000, 8000, 12000, 17000, 23000, 30000]

function getLevel(xp: number): number {
  for (let i = LEVEL_XP.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP[i]) return i + 1
  }
  return 1
}

/**
 * Issue a certificate for a completed enrollment.
 * Returns the certificate record or null if already issued.
 */
export async function issueCertificate(enrollmentId: string): Promise<{
  id: string
  verificationCode: string
} | null> {
  // Privileged server-side issuance: bypasses RLS via the service client so the
  // system can issue certificates on behalf of the student (the certificate
  // belongs to enrollment.student_id, never to the caller). Entry points must
  // gate who may trigger issuance.
  const supabase = createServiceClient()

  // Check if certificate already exists
  const { data: existing } = await supabase
    .from("certificates")
    .select("id, verification_code")
    .eq("enrollment_id", enrollmentId)
    .single()

  if (existing) return { id: existing.id, verificationCode: existing.verification_code }

  // Get enrollment with related data
  // INCIDENT FIX (2026-07-01): never issue a certificate for a soft-deleted
  // enrollment (e.g. one hidden because its course was archived).
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select(`
      id, student_id, course_id, completed_at,
      users!inner(full_name, tenant_id),
      courses!inner(title, tenant_id)
    `)
    .eq("id", enrollmentId)
    .eq("status", "completed")
    .is("deleted_at", null)
    .single()

  if (!enrollment) return null

  const user = (enrollment as any).users
  const course = (enrollment as any).courses

  // Calculate workload from sessions
  const { count: sessionCount } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("course_id", enrollment.course_id)

  // Estimate: ~45 min per session on average
  const workloadHours = Math.round(((sessionCount ?? 0) * 45) / 60 * 10) / 10

  // Get instructor name (first instructor of the tenant)
  const { data: instructor } = await supabase
    .from("users")
    .select("full_name")
    .eq("tenant_id", course.tenant_id)
    .eq("role", "instructor")
    .limit(1)
    .single()

  // Insert certificate
  const { data: cert, error } = await supabase
    .from("certificates")
    .insert({
      tenant_id: course.tenant_id,
      user_id: enrollment.student_id,
      course_id: enrollment.course_id,
      enrollment_id: enrollmentId,
      student_name: user.full_name,
      course_title: course.title,
      instructor_name: instructor?.full_name ?? null,
      workload_hours: workloadHours,
      issued_at: enrollment.completed_at ?? new Date().toISOString(),
    })
    .select("id, verification_code")
    .single()

  if (error || !cert) return null

  // Award XP for course completion
  await awardXp(enrollment.student_id, course.tenant_id, 500)

  return { id: cert.id, verificationCode: cert.verification_code }
}

/**
 * Award XP to a user and update their streak/level
 */
export async function awardXp(userId: string, tenantId: string, xpAmount: number) {
  // System-triggered XP award (on behalf of the user) — uses the service client
  // so the write is not blocked by the user-scoped RLS policy.
  const supabase = createServiceClient()
  const today = new Date().toISOString().split("T")[0]

  // Get or create gamification record
  const { data: existing } = await supabase
    .from("user_gamification")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (!existing) {
    await supabase.from("user_gamification").insert({
      user_id: userId,
      tenant_id: tenantId,
      xp: xpAmount,
      level: getLevel(xpAmount),
      current_streak: 1,
      max_streak: 1,
      last_activity_date: today,
    })
    return
  }

  // Calculate streak
  let newStreak = existing.current_streak
  const lastDate = existing.last_activity_date
  if (lastDate) {
    const last = new Date(lastDate)
    const now = new Date(today)
    const diffDays = Math.floor((now.getTime() - last.getTime()) / 86400000)

    if (diffDays === 1) {
      newStreak = existing.current_streak + 1
    } else if (diffDays > 1) {
      newStreak = 1
    }
    // diffDays === 0 means same day, keep streak
  }

  const newXp = existing.xp + xpAmount
  const streakBonus = newStreak > existing.current_streak ? 10 : 0
  const totalXp = newXp + streakBonus

  await supabase
    .from("user_gamification")
    .update({
      xp: totalXp,
      level: getLevel(totalXp),
      current_streak: newStreak,
      max_streak: Math.max(newStreak, existing.max_streak),
      last_activity_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
}
