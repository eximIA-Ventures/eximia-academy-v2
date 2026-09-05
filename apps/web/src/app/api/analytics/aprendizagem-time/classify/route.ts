// ---------------------------------------------------------------------------
// Dispara o pipeline de classificação de Aprendizagem do Time sob demanda.
//
// Fire-and-forget do ponto de vista do client: `gatilho-classificacao.tsx`
// chama isto em `useEffect` sem bloquear o render das telas, e a próxima
// carga da tela já lê o resultado — mesmo modelo de staleness já em produção
// para `semantic_analyses` (api/analytics/semantic/route.ts).
//
// NUNCA devolve conteúdo classificado — só contagem. Quem lê a classificação
// é a camada RSC de `lib/analytics/aprendizagem-time` (Entrega 2), que já
// aplica o escopo de equipe resolvido por `resolverRecorteDaTrinca`.
// ---------------------------------------------------------------------------

import { ACESSO } from "@/app/(platform)/analytics/_trinca/recorte"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import type { Role } from "@eximia/shared"
import { NextResponse } from "next/server"

export async function POST() {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const roleUnion = roles as Role[]
  if (!hasAnyRole({ roles: roleUnion }, ACESSO)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return NextResponse.json({ error: "Nenhum tenant ativo" }, { status: 400 })
  }

  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient()

  const { processarPendencias } = await import("@/lib/analytics/aprendizagem-time/classificador")

  try {
    const resultado = await processarPendencias(db, tenantId, 20)

    // ---------------------------------------------------------------------
    // TRÊS DESFECHOS, NÃO UM (C-3 do laudo LOOP-1).
    //
    // Esta rota respondia `200 {"ok":true,"processed":N}` sem nunca olhar se
    // alguma das N tentativas virou linha. Com 100% dos upserts falhando, a
    // resposta era indistinguível de um pipeline saudável — e foi essa cegueira
    // que manteve um defeito crítico invisível por dias.
    //
    //   ok      → gravou tudo o que tentou (inclusive "não havia nada a fazer")
    //   parcial → gravou parte; o dado do gestor está incompleto, e ele precisa saber
    //   falha   → tentou e não gravou nada, OU nem conseguiu ler para começar
    // ---------------------------------------------------------------------
    const naoComecou = resultado.falhaLeitura !== null
    const tentouENaoGravou = resultado.tentativas > 0 && resultado.processadas === 0
    const status =
      naoComecou || tentouENaoGravou ? "falha" : resultado.falhasDeGravacao > 0 ? "parcial" : "ok"

    const corpo = {
      ok: status === "ok",
      status,
      processed: resultado.processadas,
      attempted: resultado.tentativas,
      errors: resultado.falhasDeGravacao,
      pending: resultado.pendentesRestantes,
      reassessed: resultado.capacidadesReavaliadas,
      readFailure: resultado.falhaLeitura,
    }

    return NextResponse.json(corpo, { status: status === "falha" ? 500 : 200 })
  } catch (error) {
    console.error("[aprendizagem-time] classify route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
