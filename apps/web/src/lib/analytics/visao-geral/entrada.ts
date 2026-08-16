// ---------------------------------------------------------------------------
// Entrada PURA da Visão geral — a mesma tela, sem Supabase no caminho.
// ---------------------------------------------------------------------------
// Existem duas portas para o mesmo cálculo, e as duas desembocam em
// `montarVisaoGeral`:
//
//   • `carregarVisaoGeral(...)` — produção: lê o banco e monta.
//   • `computeVisaoGeral(entrada)` — dado bruto já em mãos: só monta.
//
// A segunda existe para o cálculo poder ser exercitado com dado sintético sem
// mock de cliente Supabase. Isso NÃO é um caminho paralelo de implementação: o
// adaptador só troca a FORMA da linha (camelCase da entrada → nomes de coluna),
// e a partir daí é byte-a-byte o mesmo código que a produção executa. Se
// divergisse, os testes estariam medindo uma segunda implementação — que é
// exatamente o defeito que um verificador desses existe para pegar.
//
// A forma de `EntradaVisaoGeral` espelha a régua dos testes de invariante
// (`__tests__/contrato.ts`). O acoplamento é ESTRUTURAL, nunca por import: a
// camada de dados não importa nada de `__tests__/`, e a régua permanece
// imutável durante o ciclo (INVARIANTES.md, rodapé).
// ---------------------------------------------------------------------------

import { janelasComparaveis } from "./dia-utc"
import type { FonteVisaoGeral, LinhaAtividade, LinhaParticipacao, LinhaSessao } from "./fonte"
import { SEM_FALHAS } from "./fonte"
import { type ContextoDeTela, montarVisaoGeral } from "./montagem"
import type { VisaoGeralDados } from "./tipos"

export interface AlunoBruto {
  id: string
  nome: string
  iniciais?: string
}

export interface AtividadeBruta {
  studentId: string
  /** ISO. Imutável — é o carimbo confiável. */
  createdAt: string
  /** ISO. Mutável: a sessão reusada faz bump só aqui (caso Rinaldo). */
  updatedAt?: string | null
  tipo?: "sessao" | "reflexao" | "quiz" | "cenario" | "atividade"
  questionId?: string | null
  chapterId?: string | null
}

export interface AcionamentoBruto {
  recipientId: string
  sentAt: string
  sentByManager?: string
}

export interface MatriculaBruta {
  studentId: string
  courseId: string
  status: "active" | "completed" | "cancelled"
  createdAt: string
  progressPercent: number
}

export interface CursoBruto {
  id: string
  deadlineDays: number | null
}

export interface CapituloBruto {
  id: string
  courseId: string
  titulo: string
  ordem: number
}

export interface EntradaVisaoGeral {
  agoraISO: string
  periodoDias: number
  gestorId: string
  /** Recorte já resolvido: é o "mesmo universo" dos dois lados de I-5. */
  escopo: readonly string[]
  alunos: readonly AlunoBruto[]
  atividades: readonly AtividadeBruta[]
  acionamentos: readonly AcionamentoBruto[]
  matriculas: readonly MatriculaBruta[]
  cursos: readonly CursoBruto[]
  capitulos?: readonly CapituloBruto[]
  tenantId?: string
  contexto?: Partial<ContextoDeTela>
}

const CONTEXTO_PADRAO: ContextoDeTela = {
  tenantNome: "",
  gestorNome: "",
  gestorPapel: "Gestor",
  escopoEquipe: "hierarquia",
  cursoFiltroNome: null,
  atualizadoEmMs: 0,
}

/** Converte a entrada bruta na MESMA `FonteVisaoGeral` que a leitura produz. */
export function fonteDaEntrada(entrada: EntradaVisaoGeral): FonteVisaoGeral {
  const agoraMs = Date.parse(entrada.agoraISO)
  const janelas = janelasComparaveis(agoraMs, entrada.periodoDias)
  const escopo = new Set(entrada.escopo)

  const sessoes: LinhaSessao[] = []
  const reflexoes: LinhaAtividade[] = []
  const quizzes: LinhaParticipacao[] = []
  const cenarios: LinhaParticipacao[] = []
  const atividadesLivres: LinhaParticipacao[] = []

  for (const a of entrada.atividades) {
    const tipo = a.tipo ?? "sessao"
    if (tipo === "sessao") {
      sessoes.push({
        student_id: a.studentId,
        created_at: a.createdAt,
        updated_at: a.updatedAt ?? null,
        question_id: a.questionId ?? null,
        chapter_id: a.chapterId ?? null,
      })
      continue
    }
    if (tipo === "reflexao") {
      reflexoes.push({
        student_id: a.studentId,
        created_at: a.createdAt,
        updated_at: a.updatedAt ?? null,
      })
      continue
    }
    const linha: LinhaParticipacao = { student_id: a.studentId, created_at: a.createdAt }
    if (tipo === "quiz") quizzes.push(linha)
    else if (tipo === "cenario") cenarios.push(linha)
    else atividadesLivres.push(linha)
  }

  // Os MESMOS predicados da consulta real (`fonte-supabase.ts`): acionamento do
  // gestor, para alguém do recorte, dentro do período. Afrouxar aqui faria o
  // teste medir um universo que a produção nunca vê.
  const acionamentos = entrada.acionamentos
    .filter((n) => n.sentByManager === undefined || n.sentByManager === entrada.gestorId)
    .filter((n) => escopo.has(n.recipientId))
    .filter((n) => {
      const t = Date.parse(n.sentAt)
      return !Number.isNaN(t) && t >= janelas.atualInicio
    })
    .map((n) => ({ recipient_id: n.recipientId, sent_at: n.sentAt }))

  return {
    tenantId: entrada.tenantId ?? "",
    gestorId: entrada.gestorId,
    escopoAlunoIds: [...entrada.escopo],
    agoraMs,
    periodoDias: entrada.periodoDias,
    alunos: entrada.alunos
      .filter((a) => escopo.has(a.id))
      .map((a) => ({ id: a.id, full_name: a.nome, report_name: null })),
    sessoes,
    reflexoes,
    matriculas: entrada.matriculas
      .filter((m) => escopo.has(m.studentId))
      .map((m) => ({
        student_id: m.studentId,
        status: m.status,
        created_at: m.createdAt,
        progress: { percentage: m.progressPercent },
        course_id: m.courseId,
      })),
    prazoPorCurso: new Map(entrada.cursos.map((c) => [c.id, c.deadlineDays])),
    quizzes,
    cenarios,
    atividades: atividadesLivres,
    acionamentos,
    capitulos: (entrada.capitulos ?? []).map((c) => ({
      id: c.id,
      course_id: c.courseId,
      title: c.titulo,
      order: c.ordem,
    })),
    falhas: SEM_FALHAS,
  }
}

/** A tela inteira a partir de dado bruto em mãos. Puro e determinístico. */
export function computeVisaoGeral(entrada: EntradaVisaoGeral): VisaoGeralDados {
  const fonte = fonteDaEntrada(entrada)
  return montarVisaoGeral(fonte, {
    ...CONTEXTO_PADRAO,
    atualizadoEmMs: fonte.agoraMs,
    ...entrada.contexto,
  })
}
