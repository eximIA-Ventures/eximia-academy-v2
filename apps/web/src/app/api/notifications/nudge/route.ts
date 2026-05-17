import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role, full_name, tenant_id").eq("id", user.id).single()
  if (!profile || !["instructor", "manager", "admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { studentName, studentEmail } = await request.json()
  if (!studentEmail) return NextResponse.json({ error: "Email required" }, { status: 400 })

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
