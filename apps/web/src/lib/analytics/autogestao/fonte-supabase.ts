// ---------------------------------------------------------------------------
// Autogestão da minha Jornada — a ÚNICA camada que fala com o Supabase.
// Somente leitura.
// ---------------------------------------------------------------------------
// Mesma doutrina I-4 de `visao-geral/fonte-supabase.ts` (o motivo de este
// arquivo existir separado): toda leitura desestrutura `error` e o transforma
// em valor. `supabase-js` devolve `{ data, error }` em vez de LANÇAR, e um
// `const { data } = await ...` engoliria a falha — a tela apresentaria um
// número menor como se fosse fato (achado A-1, 79 de 87 páginas de
// `(platform)` fazem exatamente isso).
//
// ESCOPO — um único (aluno, curso), NÃO um roster: esta é a visão do próprio
// aprendiz sobre a própria jornada, nunca a de um gestor sobre uma equipe
// (ver `fonte.ts`). `courseId` é INPUT desta função, não resolvido aqui — a
// spec §4.1 exige seleção de curso específico quando há mais de uma matrícula
// ativa, e quem monta a rota resolve isso ANTES de chamar esta camada.
//
// NENHUMA ESCRITA. Nem update, nem insert, nem RPC que mute. O `.env.local`
// deste repo aponta para o Supabase de PRODUÇÃO, compartilhado por quatro
// tenants (dois clientes pagantes).
//
// Elo 4 do `/gauntlet-2` (semear → ler pelo caminho de produção → conferir que
// o número voltou): `scripts/gauntlet/provar-elo4.mjs` importa esta função
// diretamente (Node 22+ despe tipos de `.ts` nativamente; `import type` é
// sempre apagado, mesmo com um alias `@/` que o script não resolve).
// ---------------------------------------------------------------------------

import type { createServiceClient } from "@/lib/supabase/service"
import type {
  BaselineDoPlano,
  ChaveFonteAutogestao,
  FalhasPorFonteAutogestao,
  FonteAutogestao,
  LinhaCapitulo,
  LinhaPlano,
  LinhaProgressoCapitulo,
  LinhaReflexao,
  LinhaSessao,
  ModuloDuracaoPlano,
} from "./fonte"
import { TAMANHO_PAGINA, TENANT_FUSO_HORARIO_PADRAO_MINUTOS } from "./parametros"
import type { FalhaLeitura } from "./tipos"

/** O client de serviço, sem escrever `any` neste arquivo. */
export type ClienteLeitura = ReturnType<typeof createServiceClient>

/** O formato que `supabase-js` devolve, reduzido ao que aqui importa. */
interface RespostaBruta<T> {
  data: T[] | null
  error: { message: string } | null
}

type ConstrutorPagina<T> = (de: number, ate: number) => PromiseLike<RespostaBruta<T>>

interface Leitura<T> {
  linhas: T[]
  falha: FalhaLeitura | null
}

/**
 * Lê exaustivamente, em páginas de `TAMANHO_PAGINA` linhas.
 *
 * A PRIMEIRA falha aborta e é devolvida. Nunca devolve linhas parciais como se
 * fossem o conjunto inteiro: quem consome só recebe `linhas` quando
 * `falha === null` (mesmo invariante de `visao-geral/fonte-supabase.ts`).
 *
 * O TETO DE PÁGINAS TAMBÉM É UMA FALHA (LOOP-0c, E→PARCIAL). Só existe um
 * jeito honesto de sair deste laço com `falha: null`: uma página CURTA, que
 * prova que o banco acabou. Sair por esgotar `MAX_PAGINAS` significa que o
 * banco ainda tinha linhas e nós paramos de perguntar — devolver isso sem
 * marca seria entregar 50.000 de 60.000 linhas como se fossem todas, e a
 * Autogestão publicaria o número menor como fato. É a mesma classe do erro de
 * leitura, por um caminho em que nenhum erro acontece.
 *
 * Não há paginação por LOTE DE IDS aqui (diferente do gestor): o escopo já é
 * um único aluno, não um roster — não existe lista de ids para dividir.
 */
async function ler<T>(
  chave: ChaveFonteAutogestao,
  construir: ConstrutorPagina<T>,
): Promise<Leitura<T>> {
  const MAX_PAGINAS = 50
  const linhas: T[] = []
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const de = pagina * TAMANHO_PAGINA
    const { data, error } = await construir(de, de + TAMANHO_PAGINA - 1)
    if (error) {
      return { linhas: [], falha: { codigo: chave.toUpperCase(), mensagem: error.message } }
    }
    const pagina_ = data ?? []
    linhas.push(...pagina_)
    if (pagina_.length < TAMANHO_PAGINA) return { linhas, falha: null }
  }
  return {
    linhas: [],
    falha: {
      codigo: chave.toUpperCase(),
      mensagem: `leitura truncada: o teto de ${MAX_PAGINAS} páginas (${MAX_PAGINAS * TAMANHO_PAGINA} linhas) foi atingido sem o banco acabar. O conjunto está incompleto e não pode ser apresentado como total.`,
    },
  }
}

/**
 * Resolve o offset de fuso (minutos, relativo a UTC) do TENANT, a partir de
 * `tenants.settings` já carregado — mesma forma pura de `isFeatureEnabled`
 * (`lib/tenant-features.ts`), ADAPTADA aqui e não reusada de lá: aquele
 * módulo é especificamente sobre feature flags booleanas em
 * `settings.features.*`; este campo é um NÚMERO solto na raiz de `settings`
 * (mesmo nível de `session_timeout_hours`/`max_interactions_per_session` em
 * `admin/settings/loader.ts`), formato diferente o bastante para não caber
 * na mesma função sem esticar o nome dela.
 *
 * PRECEDÊNCIA (documentada aqui por ser a ÚNICA fonte da regra):
 *   1. `settings.timezone_offset_minutes`, se o tenant configurou (número
 *      finito — qualquer outro tipo/valor é tratado como "não configurado",
 *      nunca lançado, mesma direção fail-safe de `tenant-features.ts`);
 *   2. senão, `TENANT_FUSO_HORARIO_PADRAO_MINUTOS` (Brasília, UTC−3 fixo).
 *
 * NUNCA `null`: é exatamente o `null` incondicional anterior que fazia todo
 * carimbo ser lido em UTC — ver a nota de `TENANT_FUSO_HORARIO_PADRAO_MINUTOS`
 * em `parametros.ts` para o defeito concreto que isso causava.
 *
 * PONTA PARA O ADMIN (ainda não construída, achável a partir daqui): a chave
 * é `timezone_offset_minutes`, num JSONB livre (`tenants.settings`), MESMO
 * padrão dos campos soltos que `admin/settings/loader.ts` (linha ~112,
 * `session_timeout_hours`) já lê e `admin/settings/actions.ts` (schema Zod,
 * linha ~42) já valida e mergeia. Quem for construir a tela: (1) ler o campo
 * no loader (`typeof settings.timezone_offset_minutes === "number" ? ... :
 * null`, para a UI saber se está herdando o default ou não); (2) expor um
 * input (select de fusos IANA, ou número puro) na tela; (3) adicionar
 * `timezone_offset_minutes: z.number().int().min(-720).max(840).optional()`
 * ao `tenantSettingsSchema` de `actions.ts` (a faixa real de offsets IANA,
 * em minutos); (4) mergear em `updateData.settings` do mesmo jeito que os
 * demais campos soltos já fazem ali. NENHUMA mudança em `TenantConfig`
 * (`packages/shared/src/modules/tenant-config.ts`) é necessária: aquele tipo é
 * a MARCA da empresa (`tenants.brand`, resolvida por host — D2/D4), lida uma vez
 * por requisição para pintar a tela, enquanto o fuso é dado operacional
 * consultado dentro da própria query — o mesmo motivo pelo qual
 * `session_timeout_hours` também não está lá, e sim em `tenants.settings`.
 */
export function resolverFusoHorarioMinutos(settingsTenant: unknown): number {
  if (settingsTenant && typeof settingsTenant === "object") {
    const valor = (settingsTenant as Record<string, unknown>).timezone_offset_minutes
    if (typeof valor === "number" && Number.isFinite(valor)) return valor
  }
  return TENANT_FUSO_HORARIO_PADRAO_MINUTOS
}

export interface ParametrosLeituraAutogestao {
  db: ClienteLeitura
  tenantId: string
  studentId: string
  /** Resolvido ANTES desta chamada — ver nota de escopo no cabeçalho. */
  courseId: string
  periodoDias: 7 | 30 | 90
}

/**
 * Lê tudo que a Autogestão precisa do banco, para (aluno, curso), UMA vez.
 *
 * A janela das leituras é a MAIS LARGA disponível (histórico inteiro do
 * aluno no curso — nenhum filtro de data aqui), pelo mesmo motivo do gestor:
 * "Retomando" e "onde costumo perder ritmo" precisam saber se houve uma pausa
 * ≥14 dias em QUALQUER ponto do histórico, não só dentro de `periodoDias`.
 * `periodoDias` é devolvido junto à fonte para quem monta a tela fatiar as
 * janelas atual/anterior em memória — nunca uma segunda ida ao banco.
 */
export async function lerFonteAutogestao(p: ParametrosLeituraAutogestao): Promise<FonteAutogestao> {
  const { db, tenantId, studentId, courseId, periodoDias } = p

  const falhas: Record<ChaveFonteAutogestao, FalhaLeitura | null> = {
    sessoes: null,
    reflexoes: null,
    progresso: null,
    capitulos: null,
    plano: null,
  }

  // --- sessões (vitalícia, sem filtro de data) ----------------------------
  const sessoes = await ler<LinhaSessao>("sessoes", (de, ate) =>
    db
      .from("sessions")
      .select(
        "id, chapter_id, status, created_at, completed_at, turn_number, interactions_remaining",
      )
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: true })
      .range(de, ate),
  )
  falhas.sessoes = sessoes.falha

  // --- reflexões (I-7 / achado A-6: NUNCA `response`, presença apenas) ----
  const reflexoes = await ler<LinhaReflexao>("reflexoes", (de, ate) =>
    db
      .from("slide_reflections")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: true })
      .range(de, ate),
  )
  falhas.reflexoes = reflexoes.falha

  // --- progresso por módulo (marca d'água, uma linha por (aluno,capítulo)) -
  const progresso = await ler<LinhaProgressoCapitulo>("progresso", (de, ate) =>
    db
      .from("chapter_view_progress")
      .select(
        "chapter_id, max_slide_index, slides_total_at_last_view, reached_last_slide_at, first_viewed_at, last_viewed_at",
      )
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .range(de, ate),
  )
  falhas.progresso = progresso.falha

  // --- módulos do curso, ordenados (spec §22) -----------------------------
  // `order` é palavra reservada no PostgREST: precisa das aspas no select.
  const capitulos = await ler<LinhaCapitulo>("capitulos", (de, ate) =>
    db
      .from("chapters")
      .select('id, "order", title')
      .eq("tenant_id", tenantId)
      .eq("course_id", courseId)
      .order("order", { ascending: true })
      .range(de, ate),
  )
  falhas.capitulos = capitulos.falha

  // --- plano individual — no máximo 1 linha ATIVA por (aluno, curso) ------
  // Ausência é o caminho MAJORITÁRIO (5 de 302 matrículas medidos em
  // 2026-08-21), nunca tratada como erro.
  interface LinhaPlanoBanco {
    id: string
    status: string | null
    module_durations: unknown
    start_date: string | null
    final_deadline_date: string | null
    recalculated_at: string | null
    baseline: unknown
  }
  const { data: planoRow, error: erroPlano } = await db
    .from("study_plans")
    .select(
      "id, status, module_durations, start_date, final_deadline_date, recalculated_at, baseline",
    )
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .eq("status", "active")
    .maybeSingle<LinhaPlanoBanco>()
  if (erroPlano) falhas.plano = { codigo: "PLANO", mensagem: erroPlano.message }

  const plano: LinhaPlano | null = planoRow
    ? {
        id: planoRow.id,
        status: planoRow.status,
        moduleDurations: (planoRow.module_durations ?? []) as readonly ModuloDuracaoPlano[],
        startDateISO: planoRow.start_date,
        finalDeadlineDateISO: planoRow.final_deadline_date,
        recalculatedAtISO: planoRow.recalculated_at,
        baseline: (planoRow.baseline ?? null) as BaselineDoPlano | null,
      }
    : null

  // --- fuso horário do tenant — precedência: settings > Brasília default --
  // Falha aqui NÃO entra em `falhas` (não há chave dedicada no contrato desta
  // fonte, e uma configuração ausente/ilegível é o caminho MAJORITÁRIO hoje —
  // nenhum tenant configura fuso ainda): cai no default nomeado, mesma direção
  // fail-safe de `isTenantFeatureEnabled` (`lib/tenant-features.ts`), só
  // logada para não desaparecer em silêncio caso um dia deixe de ser raro.
  const { data: tenantRow, error: erroTenant } = await db
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle<{ settings: unknown }>()
  if (erroTenant) {
    console.error(
      `[autogestao:fonte-supabase] falha ao ler tenants.settings (fuso): ${erroTenant.message}`,
    )
  }
  const fusoHorarioMinutosOffset = resolverFusoHorarioMinutos(
    erroTenant ? null : tenantRow?.settings,
  )

  return {
    tenantId,
    studentId,
    courseId,
    periodoDias,
    sessoes: sessoes.linhas,
    reflexoes: reflexoes.linhas,
    progresso: progresso.linhas,
    capitulos: capitulos.linhas,
    plano,
    // Fuso: resolvido acima (`resolverFusoHorarioMinutos`), NUNCA `null`
    // silencioso — precedência settings > Brasília default (ver a função).
    // Duração média por slide CONTINUA fora desta fronteira de I/O — ver a
    // nota em `fonte.ts`: precisa de mais do que `created_at`/`completed_at`
    // para ser medida, e é responsabilidade de quem monta a tela, não de
    // quem lê a linha crua.
    fusoHorarioMinutosOffset,
    duracaoMediaPorSlideMinutos: null,
    falhas: falhas as FalhasPorFonteAutogestao,
  }
}
