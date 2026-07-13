import { createClient } from "@/lib/supabase/server"
import { issueCertificate } from "@/lib/certificates/generate"
import { NextResponse } from "next/server"

/**
 * GET /api/certificates/[enrollmentId]
 * Returns the certificate for a completed enrollment (issues if not yet created).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const { enrollmentId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify the enrollment belongs to this user (or user is admin/instructor)
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("student_id, status")
    .eq("id", enrollmentId)
    .single()

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })
  }

  if (enrollment.status !== "completed") {
    return NextResponse.json(
      { error: "Course not yet completed" },
      { status: 400 }
    )
  }

  // Check ownership or admin role
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  const isOwner = enrollment.student_id === user.id
  const isAdmin = ["admin", "manager", "instructor", "super_admin"].includes(profile?.role ?? "")

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Issue certificate (idempotent — returns existing if already issued)
  const cert = await issueCertificate(enrollmentId)

  if (!cert) {
    return NextResponse.json(
      { error: "Failed to generate certificate" },
      { status: 500 }
    )
  }

  // Return certificate data
  const { data: fullCert } = await supabase
    .from("certificates")
    .select("*")
    .eq("id", cert.id)
    .single()

  return NextResponse.json({
    certificate: fullCert,
    verifyUrl: `/verify/${cert.verificationCode}`,
  })
}
