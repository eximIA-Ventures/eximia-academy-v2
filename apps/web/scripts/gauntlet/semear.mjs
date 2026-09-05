#!/usr/bin/env node
// ===========================================================================
// Semeador do elo 4 — Autogestão da minha Jornada.
// ===========================================================================
// Monta, DENTRO do tenant descartável (`gauntlet-descartavel`), um cenário
// determinístico com DOIS alunos — decisão do dono, 2026-08-21: "os dois
// estados nascem juntos" — porque 5 planos ativos para 302 matrículas (1,7%)
// tornam "sem plano" o caminho MAJORITÁRIO, não uma borda.
//
//   Aluno A — COM plano: study_plans com module_durations reais, start_date
//             conhecido, baseline preenchido.
//   Aluno B — SEM plano: mesma atividade (sessões, progresso), nenhuma linha
//             em study_plans.
//
// TODA escrita passa por `guardar()` (trava-de-tenant.mjs) — nenhuma linha
// alcança um tenant que não seja o descartável, ver o cabeçalho daquele
// arquivo para o porquê.
//
// Casos discriminantes plantados (pré-voo G2 do /gauntlet-2 — sem eles um
// PASS é indistinguível de sorte):
//   • 3 sessões no MESMO dia (regularidade deve contar 1 dia, não 3)
//   • uma pausa de 13 dias (NÃO conta retomada) e uma de 15/16 dias (conta)
//   • uma sessão aberta sem `completed_at`
//   • um módulo com `days: 0` no plano (marco deve dizer "falta prova")
//
// Relógio: TODAS as datas derivam de `--agora <ISO>`, nunca de `Date.now()`
// implícito — um cenário que muda de significado a cada dia reprova o G1 do
// pré-voo.
//
// Uso:
//   node scripts/gauntlet/semear.mjs --agora 2026-08-21T12:00:00Z
//   node scripts/gauntlet/semear.mjs --limpar
// ===========================================================================

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createClient } from "@supabase/supabase-js"
import {
  maiorIntervalo as calcularMaiorIntervalo,
  marco as calcularMarco,
  retomadas as calcularRetomadas,
  contarSessoesNaJanela,
  diasComAtividadeNaJanela,
  diasDesdeUltimaAtividade,
  diasDistintosDeSessao,
  diferencaEmDiasCalendario,
  janelasComparaveis,
  progressoModuloAtual,
  progressoReal,
  sessaoEmAberto,
  sessoesConcluidasModulo,
  ultimoAjusteDias,
} from "./calculos-elo4.mjs"
import { guardar, limpar, resolverTenantDescartavel } from "./trava-de-tenant.mjs"

const AQUI = dirname(fileURLToPath(import.meta.url))
const WEB = resolve(AQUI, "../..")
const REPO = resolve(WEB, "../..")
const GABARITO_PATH = resolve(REPO, "docs/gauntlet/autogestao-jornada/GABARITO.json")

const ALUNO_A_EMAIL = "elo4.aluno.a@gauntlet-descartavel.eximia.test"
const ALUNO_B_EMAIL = "elo4.aluno.b@gauntlet-descartavel.eximia.test"

const TABELAS_TENANT = [
  "sessions",
  "chapter_view_progress",
  "slide_reflections",
  "study_plans",
  "enrollments",
  "chapters",
  "courses",
  "users",
]

// ---------------------------------------------------------------------------
// Env + client (mesmo padrão de `criar-tenant-descartavel.mjs`)
// ---------------------------------------------------------------------------
function lerEnv() {
  const texto = readFileSync(resolve(WEB, ".env.local"), "utf8")
  return Object.fromEntries(
    texto
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=")
        return [
          l.slice(0, i).trim(),
          l
            .slice(i + 1)
            .trim()
            .replace(/^["']|["']$/g, ""),
        ]
      }),
  )
}

export function criarCliente() {
  const env = lerEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })
  return { db, url, serviceKey }
}

// ---------------------------------------------------------------------------
// Auth admin (GoTrue) — helpers mínimos, sem SDK, mesmo padrão de
// `demo-tenant-vertice-seed.mjs`.
// ---------------------------------------------------------------------------
async function authAdmin(url, serviceKey, method, path, body) {
  const res = await fetch(`${url}/auth/v1/admin/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

function senhaAleatoria() {
  return `E4${Math.random().toString(36).slice(2, 10)}!${Math.floor(Math.random() * 1000)}Aa`
}

/**
 * Procura um auth user por email PERCORRENDO TODAS as páginas.
 *
 * O DEFEITO QUE ISTO ARRANCA, COM O NÚMERO
 * ---------------------------------------------------------------------------
 * A versão anterior fazia uma chamada só, `users?per_page=200`, e procurava o
 * email na primeira página. Medido em 21/08/2026: o banco tem **185** auth
 * users. Margem até o corte: **15**. A Cory tem 51 usuários e o Vértice 129 —
 * um único onboarding de turma estoura isso.
 *
 * E o modo de falha é silencioso, que é o pior tipo: passando de 200, o
 * usuário de teste some da primeira página, `find` devolve `undefined`, a
 * limpeza responde `{apagado:false}` SEM erro, e o dado de teste fica em
 * produção sem que nada acuse. `auth.users` não tem `tenant_id`, então a
 * trava não alcança esta superfície — a proteção aqui é o email, e ela só
 * vale se a busca de fato varrer tudo.
 *
 * `total` é declarado pelo chamador para o log poder dizer quantos foram
 * varridos: uma busca que não achou precisa provar que procurou.
 */
async function acharAuthPorEmail(url, serviceKey, email) {
  const PAGINA = 200
  let varridos = 0
  for (let pagina = 1; pagina <= 50; pagina++) {
    const lista = await authAdmin(url, serviceKey, "GET", `users?per_page=${PAGINA}&page=${pagina}`)
    const usuarios = lista.json?.users ?? []
    varridos += usuarios.length
    const achado = usuarios.find((u) => u.email === email)
    if (achado) return { achado, varridos }
    if (usuarios.length < PAGINA) return { achado: null, varridos } // última página
  }
  throw new Error(
    `busca de auth user parou no teto de 50 páginas (${varridos} varridos) sem achar "${email}". Isto NÃO é "não existe": é "não terminei de procurar", e tratar os dois como iguais é como um usuário de teste fica em produção sem ninguém ver.`,
  )
}

/** Cria o usuário auth se não existir; reusa o id se já existir (idempotente). */
async function criarOuReutilizarAuth(url, serviceKey, email, fullName) {
  const criado = await authAdmin(url, serviceKey, "POST", "users", {
    email,
    password: senhaAleatoria(),
    email_confirm: true,
    user_metadata: { full_name: fullName, origem: "gauntlet-elo4" },
  })
  const idCriado = criado.json?.id ?? criado.json?.user?.id
  if (idCriado) return idCriado

  // Já existe — GoTrue devolve 422/"already registered". Busca em TODAS as páginas.
  const { achado, varridos } = await acharAuthPorEmail(url, serviceKey, email)
  if (!achado) {
    throw new Error(
      `auth user "${email}" não foi criado (status ${criado.status}: ${JSON.stringify(criado.json)}) ` +
        `e não foi encontrado na listagem admin (${varridos} usuários varridos).`,
    )
  }
  return achado.id
}

/** Apaga o usuário auth pelo email, se existir. Idempotente (não-erro se ausente). */
async function apagarAuthPorEmail(url, serviceKey, email) {
  const { achado } = await acharAuthPorEmail(url, serviceKey, email)
  if (!achado) return { apagado: false }
  await authAdmin(url, serviceKey, "DELETE", `users/${achado.id}`)
  return { apagado: true, id: achado.id }
}

// ---------------------------------------------------------------------------
// Relógio determinístico — tudo deriva de `agoraISO`.
// ---------------------------------------------------------------------------
const MS_DIA = 86_400_000

/** ISO de um ponto `diasAtras` dias antes de `agoraISO`, na `hora` UTC dada. */
export function pontoNoTempo(agoraISO, diasAtras, hora = 12, minuto = 0) {
  const d = new Date(Date.parse(agoraISO) - diasAtras * MS_DIA)
  d.setUTCHours(hora, minuto, 0, 0)
  return d.toISOString()
}

function dataISO(iso) {
  return iso.slice(0, 10)
}

// ---------------------------------------------------------------------------
// LIMPEZA — idempotente, chamada tanto por `--limpar` quanto antes de semear
// (garante estado zerado mesmo após um run anterior interrompido).
// ---------------------------------------------------------------------------
export async function limparTudo({ db, url, serviceKey }) {
  const tenantId = await resolverTenantDescartavel(db)
  const apagadas = await limpar(db, tenantId, TABELAS_TENANT)
  const authA = await apagarAuthPorEmail(url, serviceKey, ALUNO_A_EMAIL)
  const authB = await apagarAuthPorEmail(url, serviceKey, ALUNO_B_EMAIL)
  return { tenantId, apagadas, auth: { alunoA: authA, alunoB: authB } }
}

// ---------------------------------------------------------------------------
// SEMEADURA
// ---------------------------------------------------------------------------
export async function semearCenario({ db, url, serviceKey, agoraISO }) {
  if (!agoraISO) throw new Error("agoraISO é obrigatório — nunca Date.now() implícito.")

  // Estado zerado primeiro: idempotente mesmo após um run anterior interrompido.
  await limparTudo({ db, url, serviceKey })

  const tenantId = await resolverTenantDescartavel(db)

  // --- alunos (auth + public.users) ---------------------------------------
  const alunoAId = await criarOuReutilizarAuth(
    url,
    serviceKey,
    ALUNO_A_EMAIL,
    "Elo4 Aluno Com Plano",
  )
  const alunoBId = await criarOuReutilizarAuth(
    url,
    serviceKey,
    ALUNO_B_EMAIL,
    "Elo4 Aluno Sem Plano",
  )

  const linhasUsers = guardar(tenantId, [
    {
      id: alunoAId,
      tenant_id: tenantId,
      email: ALUNO_A_EMAIL,
      full_name: "Elo4 Aluno Com Plano",
      report_name: "Elo4 Aluno Com Plano",
      role: "student",
      onboarding_completed: true,
      profile: {},
      status: "active",
      learning_mode: "slide",
      is_test: true,
    },
    {
      id: alunoBId,
      tenant_id: tenantId,
      email: ALUNO_B_EMAIL,
      full_name: "Elo4 Aluno Sem Plano",
      report_name: "Elo4 Aluno Sem Plano",
      role: "student",
      onboarding_completed: true,
      profile: {},
      status: "active",
      learning_mode: "slide",
      is_test: true,
    },
  ])
  {
    const { error } = await db.from("users").insert(linhasUsers)
    if (error) throw new Error(`insert users: ${error.message}`)
  }

  // --- curso + 8 capítulos (compartilhados pelos dois alunos) -------------
  const linhaCurso = guardar(tenantId, [
    {
      tenant_id: tenantId,
      title: "Curso Gauntlet — Elo 4 (Autogestão)",
      description: "Curso descartável, existe só para provar o elo 4.",
      type: "regular",
      status: "published",
      created_by: alunoAId,
      settings: {},
      deadline_days: 90,
      manager_deadline_days: 75,
    },
  ])
  const { data: cursoInserido, error: erroCurso } = await db
    .from("courses")
    .insert(linhaCurso)
    .select("id")
    .single()
  if (erroCurso) throw new Error(`insert courses: ${erroCurso.message}`)
  const courseId = cursoInserido.id

  // Nomes REAIS de módulo — sem prefixo numérico ("Módulo N —") e sem sufixo
  // de estado ("(módulo atual)", "(duração 0 no plano)"). A tela de produção
  // (`_mapa/mapa-jornada-tab.tsx` L267) já concatena "Módulo {ordem} — {titulo}"
  // sozinha; um título semeado que já carrega o próprio prefixo/estado
  // duplicava a numeração ("Módulo 4 — Módulo 5 — Aplicação (módulo atual)") e
  // fazia o crítico reprovar a TELA por um defeito que era do SEED.
  //
  // Os 7 primeiros são os módulos reais da especificação, na MESMA ordem
  // (ESPECIFICACAO.md §22, exemplo 1–7: Introdução … Monitoramento) — os
  // índices 0..6 abaixo (posição = `order` da tabela `chapters`, 0-based) são
  // por isso os mesmos que os comentários de `module_durations` abaixo já
  // chamam de "módulo 4" (índice 3) e "módulo 6" (índice 5): a posição SEMPRE
  // foi 1:1 com "Módulo {índice+1}", só o texto do título é que duplicava a
  // numeração por cima. O 8º é um módulo extra de encerramento, fora do
  // exemplo de 7 da spec, também sem prefixo/sufixo.
  const TITULOS_CAPITULOS = [
    "Introdução",
    "Definir o Problema",
    "Identificar o Problema",
    "Análise de Causa",
    "Ações Corretivas",
    "Executar Ações Corretivas",
    "Monitoramento",
    "Encerramento",
  ]
  const linhasCapitulos = guardar(
    tenantId,
    TITULOS_CAPITULOS.map((title, order) => ({
      tenant_id: tenantId,
      course_id: courseId,
      title,
      order,
      status: "published",
    })),
  )
  const { data: capitulosInseridos, error: erroCapitulos } = await db
    .from("chapters")
    .insert(linhasCapitulos)
    .select("id, order, title")
  if (erroCapitulos) throw new Error(`insert chapters: ${erroCapitulos.message}`)
  const capitulos = [...capitulosInseridos].sort((a, b) => a.order - b.order)
  const CH = capitulos.map((c) => c.id) // CH[0..7], por índice de order

  // --- matrículas -----------------------------------------------------------
  const linhasEnrollments = guardar(tenantId, [
    {
      student_id: alunoAId,
      course_id: courseId,
      tenant_id: tenantId,
      status: "active",
      progress: {},
    },
    {
      student_id: alunoBId,
      course_id: courseId,
      tenant_id: tenantId,
      status: "active",
      progress: {},
    },
  ])
  const { data: enrollmentsInseridos, error: erroEnroll } = await db
    .from("enrollments")
    .insert(linhasEnrollments)
    .select("id, student_id")
  if (erroEnroll) throw new Error(`insert enrollments: ${erroEnroll.message}`)
  const enrollmentA = enrollmentsInseridos.find((e) => e.student_id === alunoAId)
  const enrollmentB = enrollmentsInseridos.find((e) => e.student_id === alunoBId)

  // ===========================================================================
  // ALUNO A — COM plano
  // ===========================================================================
  // Sessões (offsets em dias antes de `agoraISO`). Distintos de calendário:
  // {70,55,42,27,12,9,8,6,5,3,2} — dedup do cluster do dia 2 (3 sessões).
  //   gaps: 70→55=15 (retomada) · 55→42=13 (NÃO retomada) · 42→27=15 (retomada)
  //         27→12=15 (retomada) · 12→9=3 · 9→8=1 · 8→6=2 · 6→5=1 · 5→3=2 · 3→2=1
  //   maior intervalo = 15 · retomadas = 3
  const sessoesA = [
    { chapterId: CH[1], diasAtras: 70, hora: 10, status: "completed" },
    { chapterId: CH[1], diasAtras: 55, hora: 10, status: "completed" },
    { chapterId: CH[1], diasAtras: 42, hora: 10, status: "completed" },
    { chapterId: CH[0], diasAtras: 27, hora: 10, status: "completed" },
    { chapterId: CH[1], diasAtras: 12, hora: 10, status: "completed" },
    { chapterId: CH[4], diasAtras: 9, hora: 9, status: "completed" },
    { chapterId: CH[4], diasAtras: 8, hora: 9, status: "completed" },
    { chapterId: CH[1], diasAtras: 6, hora: 11, status: "completed" },
    { chapterId: CH[1], diasAtras: 5, hora: 10, status: "completed" },
    { chapterId: CH[4], diasAtras: 3, hora: 15, status: "active" }, // ABERTA — "há 3 dias"
    { chapterId: CH[0], diasAtras: 2, hora: 9, status: "completed" }, // cluster do MESMO dia
    { chapterId: CH[0], diasAtras: 2, hora: 14, status: "completed" },
    { chapterId: CH[0], diasAtras: 2, hora: 20, status: "completed" },
  ]

  const linhasSessoesA = guardar(
    tenantId,
    sessoesA.map((s) => {
      const created_at = pontoNoTempo(agoraISO, s.diasAtras, s.hora)
      return {
        student_id: alunoAId,
        chapter_id: s.chapterId,
        tenant_id: tenantId,
        status: s.status,
        created_at,
        completed_at: s.status === "completed" ? created_at : null,
      }
    }),
  )
  {
    const { error } = await db.from("sessions").insert(linhasSessoesA)
    if (error) throw new Error(`insert sessions (A): ${error.message}`)
  }

  // chapter_view_progress — CH0..CH3 concluídos (4 de 8 = 50%, contrato 1.4),
  // CH4 em andamento (6/10 = 60%, contrato 3.2), CH5..CH7 não iniciados.
  const cvpA = [
    { chapterId: CH[0], first: 70, reached: 27, last: 2, lastHora: 20, max: 10, total: 10 },
    { chapterId: CH[1], first: 65, reached: 42, last: 5, lastHora: 20, max: 8, total: 8 },
    { chapterId: CH[2], first: 60, reached: 50, last: 45, lastHora: 20, max: 6, total: 6 },
    { chapterId: CH[3], first: 50, reached: 35, last: 32, lastHora: 20, max: 7, total: 7 },
    { chapterId: CH[4], first: 9, reached: null, last: 3, lastHora: 15, max: 6, total: 10 },
  ]
  const linhasCvpA = guardar(
    tenantId,
    cvpA.map((p) => ({
      student_id: alunoAId,
      chapter_id: p.chapterId,
      tenant_id: tenantId,
      max_slide_index: p.max,
      slides_total_at_last_view: p.total,
      reached_last_slide_at: p.reached === null ? null : pontoNoTempo(agoraISO, p.reached, 18),
      first_viewed_at: pontoNoTempo(agoraISO, p.first, 8),
      last_viewed_at: pontoNoTempo(agoraISO, p.last, p.lastHora),
    })),
  )
  {
    const { error } = await db.from("chapter_view_progress").insert(linhasCvpA)
    if (error) throw new Error(`insert chapter_view_progress (A): ${error.message}`)
  }

  // study_plans — module_durations: CH3 (módulo 4) = 20 dias → marco com data.
  // CH5 (módulo 6) = 0 dias → marco "falta prova" (decisão do dono, 3.6).
  const duracoes = [10, 10, 10, 20, 10, 0, 10, 10]
  const moduleDurations = CH.map((chapterId, i) => ({ chapterId, days: duracoes[i] }))
  const startDateA = pontoNoTempo(agoraISO, 80, 12) // predata a atividade mais antiga (70d)
  const recalculatedAtA = pontoNoTempo(agoraISO, 21, 12) // contrato 1.16: "há 21 dias"

  const linhaPlano = guardar(tenantId, [
    {
      tenant_id: tenantId,
      enrollment_id: enrollmentA.id,
      student_id: alunoAId,
      course_id: courseId,
      status: "active",
      module_durations: moduleDurations,
      preset: null,
      preferences: { cascade: true, unit: "w" },
      start_date: dataISO(startDateA),
      final_deadline_date: null,
      manager_deadline_date: null,
      recalculated_at: recalculatedAtA,
      baseline: {
        capturedAt: startDateA,
        progressPct: 0,
        sessionsDone: 0,
        reflectionsDone: 0,
        completedChapterIds: [],
      },
    },
  ])
  {
    const { error } = await db.from("study_plans").insert(linhaPlano)
    if (error) throw new Error(`insert study_plans: ${error.message}`)
  }

  // ===========================================================================
  // ALUNO B — SEM plano (mesma atividade, números independentes)
  // ===========================================================================
  // Distintos de calendário: {48,32,19,10,6,5,4}.
  //   gaps: 48→32=16 (retomada) · 32→19=13 (NÃO retomada) · 19→10=9 · 10→6=4
  //         6→5=1 · 5→4=1
  //   maior intervalo = 16 · retomadas = 1
  const sessoesB = [
    { chapterId: CH[2], diasAtras: 48, hora: 10, status: "completed" },
    { chapterId: CH[2], diasAtras: 32, hora: 10, status: "completed" },
    { chapterId: CH[2], diasAtras: 19, hora: 10, status: "completed" },
    { chapterId: CH[0], diasAtras: 10, hora: 10, status: "completed" },
    { chapterId: CH[0], diasAtras: 6, hora: 9, status: "completed" },
    { chapterId: CH[0], diasAtras: 6, hora: 15, status: "completed" }, // MESMO dia do anterior
    { chapterId: CH[2], diasAtras: 5, hora: 11, status: "completed" },
    { chapterId: CH[2], diasAtras: 4, hora: 9, status: "active" }, // ABERTA — "há 4 dias"
  ]
  const linhasSessoesB = guardar(
    tenantId,
    sessoesB.map((s) => {
      const created_at = pontoNoTempo(agoraISO, s.diasAtras, s.hora)
      return {
        student_id: alunoBId,
        chapter_id: s.chapterId,
        tenant_id: tenantId,
        status: s.status,
        created_at,
        completed_at: s.status === "completed" ? created_at : null,
      }
    }),
  )
  {
    const { error } = await db.from("sessions").insert(linhasSessoesB)
    if (error) throw new Error(`insert sessions (B): ${error.message}`)
  }

  // CH0, CH1 concluídos (2 de 8 = 25%, contrato 1.4) — DIFERENTE de A (50%).
  // CH2 em andamento (4/5 = 80%, contrato 3.2) — DIFERENTE de A (60%).
  const cvpB = [
    { chapterId: CH[0], first: 10, reached: 6, last: 6, lastHora: 20, max: 5, total: 5 },
    { chapterId: CH[1], first: 25, reached: 20, last: 20, lastHora: 20, max: 8, total: 8 },
    { chapterId: CH[2], first: 20, reached: null, last: 4, lastHora: 9, max: 4, total: 5 },
  ]
  const linhasCvpB = guardar(
    tenantId,
    cvpB.map((p) => ({
      student_id: alunoBId,
      chapter_id: p.chapterId,
      tenant_id: tenantId,
      max_slide_index: p.max,
      slides_total_at_last_view: p.total,
      reached_last_slide_at: p.reached === null ? null : pontoNoTempo(agoraISO, p.reached, 18),
      first_viewed_at: pontoNoTempo(agoraISO, p.first, 8),
      last_viewed_at: pontoNoTempo(agoraISO, p.last, p.lastHora),
    })),
  )
  {
    const { error } = await db.from("chapter_view_progress").insert(linhasCvpB)
    if (error) throw new Error(`insert chapter_view_progress (B): ${error.message}`)
  }

  // Nenhuma linha em study_plans para B — o caminho MAJORITÁRIO (decisão do dono).

  // ===========================================================================
  // GABARITO — computado pelas MESMAS fórmulas que `provar-elo4.mjs` reusa,
  // aplicadas às linhas exatas que acabamos de escrever (não à leitura do
  // banco — é isso que faz a comparação, no outro script, uma prova real do
  // caminho de leitura, e não um teste de si mesmo).
  // ===========================================================================
  const periodoDias = 7
  const janelas = janelasComparaveis(agoraISO, periodoDias)

  function gabaritoDoAluno(sessoes, cvpRows, chapterAlvoAtual, plano) {
    const progresso = cvpRows.map((p) => ({
      chapter_id: p.chapterId,
      max_slide_index: p.max,
      slides_total_at_last_view: p.total,
      reached_last_slide_at: p.reached === null ? null : pontoNoTempo(agoraISO, p.reached, 18),
      last_viewed_at: pontoNoTempo(agoraISO, p.last, 12),
    }))
    const sessoesRaw = sessoes.map((s) => ({
      chapter_id: s.chapterId,
      created_at: pontoNoTempo(agoraISO, s.diasAtras, s.hora),
      completed_at: s.status === "completed" ? pontoNoTempo(agoraISO, s.diasAtras, s.hora) : null,
    }))
    const reflexoes = []

    const atual = diasComAtividadeNaJanela(janelas.atualInicio, janelas.atualFim, {
      sessoes: sessoesRaw,
      reflexoes,
      progresso,
    })
    const anterior = diasComAtividadeNaJanela(janelas.anteriorInicio, janelas.anteriorFim, {
      sessoes: sessoesRaw,
      reflexoes,
      progresso,
    })
    const progressoRealCalc = progressoReal(
      progresso,
      capitulos.map((c) => ({ id: c.id })),
    )
    const aberta = sessaoEmAberto(agoraISO, sessoesRaw)
    const progressoAtualCalc = progressoModuloAtual(
      progresso.find((p) => p.chapter_id === chapterAlvoAtual) ?? null,
    )
    const modSessoes = sessoesConcluidasModulo(sessoesRaw, chapterAlvoAtual)

    return {
      "1.2_regularidade_dias_distintos_janela_atual": atual.size,
      "1.2_regularidade_dias_distintos_janela_anterior": anterior.size,
      "1.4_progresso_real_percentual": progressoRealCalc.percentual,
      "1.4_progresso_real_numerador": progressoRealCalc.numerador,
      "1.4_progresso_real_total": progressoRealCalc.total,
      "1.6_dias_desde_ultima_atividade": diasDesdeUltimaAtividade(agoraISO, {
        sessoes: sessoesRaw,
        reflexoes,
        progresso,
      }),
      "1.9_delta_sessoes":
        contarSessoesNaJanela(janelas.atualInicio, janelas.atualFim, sessoesRaw) -
        contarSessoesNaJanela(janelas.anteriorInicio, janelas.anteriorFim, sessoesRaw),
      "1.9_sessoes_janela_atual": contarSessoesNaJanela(
        janelas.atualInicio,
        janelas.atualFim,
        sessoesRaw,
      ),
      "1.9_sessoes_janela_anterior": contarSessoesNaJanela(
        janelas.anteriorInicio,
        janelas.anteriorFim,
        sessoesRaw,
      ),
      "1.14_sessao_em_aberto_dias": aberta ? aberta.diasAberta : null,
      "1.16_ultimo_ajuste_dias": ultimoAjusteDias(agoraISO, plano),
      "2.4_maior_intervalo_dias": calcularMaiorIntervalo(sessoesRaw),
      "2.6_retomadas": calcularRetomadas(sessoesRaw),
      "3.2_progresso_modulo_atual_percentual": progressoAtualCalc,
      "3.4_sessoes_concluidas_modulo": modSessoes.concluidas,
      "3.4_sessoes_total_modulo": modSessoes.total,
      "3.6_marco_modulo4": plano
        ? calcularMarco(
            plano,
            capitulos.map((c) => ({ id: c.id })),
            CH[3],
          )
        : { faltaProva: true, motivo: "sem-plano" },
      "3.6_marco_modulo6_duracao_zero": plano
        ? calcularMarco(
            plano,
            capitulos.map((c) => ({ id: c.id })),
            CH[5],
          )
        : { faltaProva: true, motivo: "sem-plano" },
    }
  }

  const planoParaCalculo = {
    module_durations: moduleDurations,
    start_date: dataISO(startDateA),
    recalculated_at: recalculatedAtA,
  }

  const gabarito = {
    agoraISO,
    periodoDias,
    tenantId,
    courseId,
    capituloIds: CH,
    alunoA: {
      studentId: alunoAId,
      enrollmentId: enrollmentA.id,
      chapterAtualIndex: 4,
      temPlano: true,
      elementos: gabaritoDoAluno(sessoesA, cvpA, CH[4], planoParaCalculo),
    },
    alunoB: {
      studentId: alunoBId,
      enrollmentId: enrollmentB.id,
      chapterAtualIndex: 2,
      temPlano: false,
      elementos: gabaritoDoAluno(sessoesB, cvpB, CH[2], null),
    },
  }

  return {
    gabarito,
    ids: {
      tenantId,
      courseId,
      capituloIds: CH,
      alunoAId,
      alunoBId,
      enrollmentAId: enrollmentA.id,
      enrollmentBId: enrollmentB.id,
    },
    // ---------------------------------------------------------------------
    // Blocos crus do cenário — para quem quiser construir um `FonteAutogestao`
    // CONHECIDO (sem ir ao banco) e alimentar `montarVisaoGeralAutogestao` /
    // `montarPadroesAutogestao` / `montarMapaAutogestao` (produção de verdade).
    // É a mesma fonte única de verdade do cenário, sem duplicar os literais em
    // outro arquivo — só reempacotados no formato que os montadores esperam.
    // ---------------------------------------------------------------------
    cenario: {
      agoraISO,
      periodoDias,
      tenantId,
      courseId,
      capitulos: capitulos.map((c) => ({ id: c.id, order: c.order, title: c.title })),
      alunoA: {
        studentId: alunoAId,
        chapterAtualIndex: 4,
        sessoes: sessoesA,
        cvp: cvpA,
        plano: {
          moduleDurations,
          startDateISO: dataISO(startDateA),
          finalDeadlineDateISO: null,
          recalculatedAtISO: recalculatedAtA,
          baseline: {
            capturedAt: startDateA,
            progressPct: 0,
            sessionsDone: 0,
            reflectionsDone: 0,
            completedChapterIds: [],
          },
        },
      },
      alunoB: {
        studentId: alunoBId,
        chapterAtualIndex: 2,
        sessoes: sessoesB,
        cvp: cvpB,
        plano: null,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
async function cli() {
  const argv = process.argv.slice(2)
  const limparFlag = argv.includes("--limpar")
  const agoraIdx = argv.indexOf("--agora")
  const agoraISO = agoraIdx >= 0 ? argv[agoraIdx + 1] : null

  const { db, url, serviceKey } = criarCliente()

  if (limparFlag) {
    const resultado = await limparTudo({ db, url, serviceKey })
    console.log("[semear --limpar]", JSON.stringify(resultado, null, 2))
    const totalLinhas = Object.values(resultado.apagadas).reduce((a, b) => a + b, 0)
    console.log(`[semear --limpar] total de linhas apagadas nas tabelas do tenant: ${totalLinhas}`)
    return
  }

  if (!agoraISO) {
    console.error("Uso: node semear.mjs --agora <ISO> | node semear.mjs --limpar")
    process.exit(1)
  }

  const { gabarito, ids } = await semearCenario({ db, url, serviceKey, agoraISO })

  mkdirSync(dirname(GABARITO_PATH), { recursive: true })
  writeFileSync(GABARITO_PATH, JSON.stringify(gabarito, null, 2))

  console.log("[semear] ids:", JSON.stringify(ids, null, 2))
  console.log("[semear] GABARITO gravado em:", GABARITO_PATH)
  console.log("[semear] gabarito:", JSON.stringify(gabarito, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  cli().catch((err) => {
    console.error("\nFATAL:", err)
    process.exit(1)
  })
}
