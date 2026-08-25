// ---------------------------------------------------------------------------
// GET /api/analytics/autogestao/padroes — Autogestão da minha Jornada,
// Tela 2 "Meus padrões e tendências" (CONTRATO-DE-DADOS.md, itens 2.1–2.8).
// ---------------------------------------------------------------------------
// Casca fina, mesmo padrão de `visao-geral/route.ts`: autentica + resolve
// contexto (`_contexto.ts`), lê a fonte real (`fonte-supabase.ts`) e monta a
// resposta com o montador puro (`montarPadroesAutogestao`). NENHUMA regra de
// negócio aqui.
// ---------------------------------------------------------------------------

import { lerFonteAutogestao } from "@/lib/analytics/autogestao/fonte-supabase"
import { montarPadroesAutogestao } from "@/lib/analytics/autogestao/montagem"
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

  const dados = montarPadroesAutogestao(fonte, ctx.agora)
  return NextResponse.json(dados)
}
