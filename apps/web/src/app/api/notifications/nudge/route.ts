import { resolveCallerStudentScope } from "@/lib/area-context"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const bodySchema = z.object({
  studentId: z.string().uuid(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name, tenant_id")
    .eq("id", user.id)
    .single()
  if (!profile || !["instructor", "manager", "admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const { studentId } = parsed.data

  // Validate the student belongs to the caller's tenant and obtain email/name from DB.
  // Never trust email/name from the request body — prevents sending to arbitrary addresses.
  if (!profile.tenant_id) {
    return NextResponse.json({ error: "Nenhum tenant ativo" }, { status: 400 })
  }

  // NON-LEAKAGE TRAVA (app-layer, same philosophy as campaign / manager-nudge):
  // the role gate above admits manager/instructor, but the tenant-membership check
  // below would otherwise let them nudge ANY student in the tenant. Resolve the
  // caller's reachable student universe and intersect the requested studentId
  // against it. admin/super_admin → null (no filter, tenant-wide, unchanged). A
  // non-null scope that does NOT contain studentId → fail-closed 403 (never sent).
  // `supabase` is the caller's AUTHENTICATED client (required by the subtree branch).
  const scope = await resolveCallerStudentScope(supabase, profile.tenant_id, user.id, profile.role)
  if (scope != null && !scope.includes(studentId)) {
    return NextResponse.json({ error: "Student outside your scope" }, { status: 403 })
  }

  const { data: student } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", studentId)
    .eq("tenant_id", profile.tenant_id)
    .eq("role", "student")
    .single()
  if (!student?.email) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 })
  }
  const studentName = student.full_name ?? "aluno"
  const studentEmail = student.email

  // Send via Resend if configured
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "eximIA Academy <noreply@eximiaventures.com.br>",
          to: studentEmail,
          subject: "Sentimos sua falta na plataforma!",
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #1a1a2e; font-size: 20px;">Olá, ${studentName}!</h2>
              <p style="color: #555; line-height: 1.6;">
                Notamos que você não acessa a plataforma há alguns dias. Seu progresso é importante para nós!
              </p>
              <p style="color: #555; line-height: 1.6;">
                Retome de onde parou — cada interação conta para o seu desenvolvimento.
              </p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://cory.eximia.academy"}/dashboard"
                style="display: inline-block; background: #e07a2f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
                Acessar a plataforma
              </a>
              <p style="color: #999; font-size: 12px; margin-top: 32px;">
                Enviado por ${profile.full_name ?? "seu instrutor"} via eximIA Academy.
              </p>
            </div>
          `,
        }),
      })
    } catch (err) {
      console.error("[nudge] Resend error:", err)
      return NextResponse.json({ error: "Failed to send" }, { status: 500 })
    }
  }

  return NextResponse.json({ sent: true, to: studentEmail })
}
