import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile || !["instructor", "manager", "admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { tab, metrics } = await request.json()

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 })

  const systemPrompt = `Você é um consultor educacional analisando dados de uma plataforma de treinamento corporativo (eximIA Academy).
Gere 3-5 insights curtos e acionáveis baseados nos dados fornecidos.
Cada insight deve ter: type (positive/warning/critical/info) e text (1 frase, max 120 chars).
Responda APENAS em JSON: { "insights": [{ "type": "...", "text": "..." }] }
Seja direto, específico, e focado em AÇÃO — o que o instrutor deve fazer.
Use português brasileiro.`

  const userPrompt = tab === "uso"
    ? `Dados de USO DA PLATAFORMA:
- Sessões no período: ${metrics.totalSessions}
- Variação vs anterior: ${metrics.deltaSessions ?? "N/A"}%
- Engajamento: ${metrics.engagementRate ?? 0}%
- Alunos que nunca acessaram: ${metrics.neverAccessed} de ${metrics.totalStudents}
- Alunos inativos (14+ dias): ${metrics.inactive}
- Unidades: ${metrics.units?.map((u: any) => `${u.name}: ${u.activePct}% ativos, ${u.completionPct}% conclusão`).join("; ") ?? "N/A"}`
    : `Dados de APRENDIZAGEM:
- Profundidade média: ${metrics.avgDepth}/7
- Total de reflexões: ${metrics.totalReflections}
- Total de alunos: ${metrics.totalStudents}
- Módulos sem reflexão: ${metrics.zeroReflModules ?? 0}
- Módulo com mais reflexões: "${metrics.topModule ?? "N/A"}" (${metrics.topModuleCount ?? 0})
- Média de palavras por reflexão: ${metrics.avgWords ?? 0}`

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(content.replace(/```json\n?/g, "").replace(/```/g, ""))
    return NextResponse.json(parsed)
  } catch (err) {
    console.error("[insights] AI error:", err)
    return NextResponse.json({ insights: [] })
  }
}
