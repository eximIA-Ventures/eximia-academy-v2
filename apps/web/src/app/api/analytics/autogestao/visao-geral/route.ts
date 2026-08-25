// ---------------------------------------------------------------------------
// GET /api/analytics/autogestao/visao-geral — Autogestão da minha Jornada,
// Tela 1 (CONTRATO-DE-DADOS.md, itens 1.1–1.22).
// ---------------------------------------------------------------------------
// Casca fina: autentica + resolve contexto (`_contexto.ts`), lê a fonte real
// (`fonte-supabase.ts`) e monta a resposta com o montador puro
// (`montarVisaoGeralAutogestao`). NENHUMA regra de negócio aqui — ela mora na
// camada de dados.
// ---------------------------------------------------------------------------

import { lerFonteAutogestao } from "@/lib/analytics/autogestao/fonte-supabase"
import { montarVisaoGeralAutogestao } from "@/lib/analytics/autogestao/montagem"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { resolverContextoAutogestao, respostaDeFalhaDaFonte } from "../_contexto"

export async function GET(request: Request) {
  const ctx = await resolverContextoAutogestao(request)
  if (!ctx.ok) return ctx.response

  const db = createServiceClient()
  const fonte = await lerFonteAutogestao({
    db,
    tenantId: ctx.tenantId,
    studentId: ctx.studentId,
    courseId: ctx.courseId,
    periodoDias: ctx.periodoDias,
  })

  const respostaDeFalha = respostaDeFalhaDaFonte(fonte.falhas)
  if (respostaDeFalha) return respostaDeFalha

  const dados = montarVisaoGeralAutogestao(fonte, ctx.agora)
  return NextResponse.json(dados)
}
