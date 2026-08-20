// PATCH /api/admin/engagement/suggestions/[id]
// Body: { action: "approve" | "dismiss" }
// Approves or dismisses a pending nudge suggestion.
//
// PORTÃO DO ACIONAMENTO (2026-08-19). Esta é a QUARTA porta para a mesma escrita
// em `notifications`. Os commits d08b5b4 e 2626ce1 fecharam as três que chamam
// `dispatchTeamNudge`; aprovar uma sugestão escreve por caminho próprio, dentro
// de `approveSuggestion`, e ficou de fora: `grep -c "process.env"` nesta rota
// voltava 0 e nada olhava conclusão. Como a sugestão carrega `nudge_type`
// (`sug.type`), a distinção cobrança vs. reconhecimento tem em que se apoiar
// aqui — nada de regra nova, os mesmos dois guardas.
//
// A DIVISÃO ENTRE AS DUAS TRAVAS, e por que não estão no mesmo lugar:
//   • o PORTÃO fica AQUI, como nas três irmãs, e recusa antes de qualquer
//     leitura de banco;
//   • o FILTRO DE CONCLUÍDOS fica em `approveSuggestion` (passo 3b), porque só
//     lá existem o `NudgeType` da sugestão e a lista já re-escopada de alvos.
//     Trazê-lo para cá exigiria carregar a sugestão duas vezes e escrever uma
//     segunda resolução de destinatários — a divergência que este conjunto de
//     commits existe para eliminar.

import { resolveCallerStudentScope } from "@/lib/area-context"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { approveSuggestion, dismissSuggestion } from "@/lib/notifications/engine"
import {
  FalhaAoVerificarConclusao,
  acionamentoLiberadoNoServidor,
} from "@/lib/notifications/portao-de-acionamento"
import { hasAnyRole } from "@/lib/role-helpers"
import { NextResponse } from "next/server"

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: suggestionId } = await params

  const { user, profile, roles, supabase } = await getAuthProfile()
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // Aprovação/dispensa de sugestões liberada para instrutores e gestores (além
  // de admin) — eles conhecem os alunos e decidem quais nudges disparar.
  if (!hasAnyRole({ roles }, ["admin", "manager", "instructor", "super_admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

  const body = await request.json().catch(() => null)
  const action = body?.action as string | undefined
  if (action !== "approve" && action !== "dismiss") {
    return NextResponse.json({ error: "action must be 'approve' or 'dismiss'" }, { status: 400 })
  }

  // PORTÃO — só sobre `approve`, que é o que ACIONA o aluno. Roda depois de
  // conhecer a ação (ela vem no corpo) e antes de ler o banco ou escrever: se o
  // dono do produto desligou o acionamento nesta instalação, a rota recusa sem
  // tocar em nada. 503 e não 403 porque não é falta de permissão do chamador, é
  // a instalação inteira com o envio fechado.
  //
  // `dismiss` fica FORA do portão de propósito: dispensar não alcança aluno
  // nenhum, só tira a sugestão da fila. Travá-la deixaria o gestor sem como
  // limpar a fila enquanto os envios estão desligados — o remédio viraria o
  // próximo incidente, exatamente o que "ausente ⇒ liberado" evita do outro lado.
  if (action === "approve" && !acionamentoLiberadoNoServidor()) {
    return NextResponse.json(
      { error: "Acionamento desligado nesta instalação (ACIONAMENTO_ATIVO)" },
      { status: 503 },
    )
  }

  try {
    if (action === "approve") {
      // NON-LEAKAGE TRAVA (app-layer): approve DISPATCHES notifications/emails to
      // the suggestion's target students — a tenant-wide cohort. Scope the dispatch
      // to the caller's own reach so a manager/instructor cannot notify students
      // outside their team/area; out-of-scope targets become recipientsSkipped.
      // admin/super_admin → null (tenant-wide, unchanged). The subtree branch reads
      // auth.uid(), so the AUTHENTICATED `supabase` client is required here.
      const scope = await resolveCallerStudentScope(supabase, tenantId, user.id, roles)
      const result = await approveSuggestion({
        tenantId,
        suggestionId,
        approvedBy: user.id,
        allowedStudentIds: scope,
      })
      return NextResponse.json(result)
    }
    // dismiss does NOT dispatch — no scope filter needed (the engine only flips
    // the suggestion status, tenant-scoped, without reaching any student).
    const result = await dismissSuggestion({
      tenantId,
      suggestionId,
      dismissedBy: user.id,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error(`[engagement/suggestions/${suggestionId} PATCH]`, err)
    // I-4: não conseguir VERIFICAR quem concluiu não é pedido malformado. 503
    // preserva a diferença entre "o cliente errou" e "o banco não respondeu" —
    // a mesma resposta que as três rotas irmãs dão para a mesma falha.
    if (err instanceof FalhaAoVerificarConclusao) {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
