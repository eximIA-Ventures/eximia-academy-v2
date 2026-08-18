// ---------------------------------------------------------------------------
// Construtor de cenários dos testes de "Padrões e tendências".
// ---------------------------------------------------------------------------
// TODO teste desta pasta monta o mundo aqui e chama `computePadroesTendencias`,
// que é a MESMA porta que a rota de preview usa. Não há segundo caminho de
// cálculo: se houvesse, os testes estariam medindo uma implementação que a tela
// não executa.
//
// O relógio é CONGELADO (`AGORA`) e entra por parâmetro. Nenhum teste chama
// `Date.now()`, e nenhuma função da camada tem como chamar.
// ---------------------------------------------------------------------------

import type {
  AlunoBruto,
  AtividadeBruta,
  CapituloBruto,
  CursoBruto,
  EntradaVisaoGeral,
  MatriculaBruta,
} from "../entrada"

export const AGORA = "2026-08-17T12:00:00.000Z"
export const AGORA_MS = Date.parse(AGORA)
export const DIA_MS = 86_400_000
export const SEMANA_MS = 7 * DIA_MS

/**
 * ISO de `n` dias atrás, às 10h UTC.
 *
 * A hora fixa em 10h contra um "agora" de 12h é deliberada: todo carimbo cai a
 * 2h DENTRO do dia, longe das fronteiras de balde semanal, então o índice de
 * semana de um offset nunca é ambíguo por 1 minuto de arredondamento.
 */
export function diasAtras(n: number, hora = 10): string {
  const base = AGORA_MS - n * DIA_MS
  const dia = new Date(base).toISOString().slice(0, 10)
  return `${dia}T${String(hora).padStart(2, "0")}:00:00.000Z`
}

export interface PessoaCenario {
  id: string
  nome?: string
  /** Offsets em dias: cada um vira uma sessão. */
  sessoes?: readonly number[]
  /** Offsets em dias: cada um vira uma reflexão (carimbo, nunca texto). */
  reflexoes?: readonly number[]
  /** Sessões ligadas a capítulo: `{ [capituloId]: offsets }`. */
  porCapitulo?: Readonly<Record<string, readonly number[]>>
  matricula?: {
    status?: "active" | "completed" | "cancelled"
    progresso?: number
    cursoId?: string
    criadaDiasAtras?: number
  }
  /** `true` remove a matrícula: a pessoa existe no recorte e nunca iniciou. */
  semMatricula?: boolean
}

export interface ArgsCenario {
  pessoas: readonly PessoaCenario[]
  periodoDias?: number
  agoraISO?: string
  capitulos?: readonly CapituloBruto[]
  cursos?: readonly CursoBruto[]
}

const CURSO_PADRAO: CursoBruto = { id: "c1", deadlineDays: null }

export function cenario(args: ArgsCenario): EntradaVisaoGeral {
  const alunos: AlunoBruto[] = []
  const atividades: AtividadeBruta[] = []
  const matriculas: MatriculaBruta[] = []

  for (const p of args.pessoas) {
    alunos.push({ id: p.id, nome: p.nome ?? `Pessoa ${p.id}` })

    for (const offset of p.sessoes ?? []) {
      atividades.push({ studentId: p.id, createdAt: diasAtras(offset), tipo: "sessao" })
    }
    for (const offset of p.reflexoes ?? []) {
      atividades.push({ studentId: p.id, createdAt: diasAtras(offset), tipo: "reflexao" })
    }
    for (const [capituloId, offsets] of Object.entries(p.porCapitulo ?? {})) {
      for (const offset of offsets) {
        atividades.push({
          studentId: p.id,
          createdAt: diasAtras(offset),
          tipo: "sessao",
          chapterId: capituloId,
        })
      }
    }

    if (p.semMatricula) continue
    matriculas.push({
      studentId: p.id,
      courseId: p.matricula?.cursoId ?? CURSO_PADRAO.id,
      status: p.matricula?.status ?? "active",
      createdAt: diasAtras(p.matricula?.criadaDiasAtras ?? 120),
      progressPercent: p.matricula?.progresso ?? 10,
    })
  }

  return {
    agoraISO: args.agoraISO ?? AGORA,
    periodoDias: args.periodoDias ?? 30,
    gestorId: "gestor-1",
    escopo: args.pessoas.map((p) => p.id),
    alunos,
    atividades,
    acionamentos: [],
    matriculas,
    cursos: args.cursos ?? [CURSO_PADRAO],
    capitulos: args.capitulos ?? [],
    tenantId: "t1",
  }
}

/** Dias que fazem alguém REGULAR na janela atual: 2 dias em cada uma de 2 semanas. */
export const DIAS_REGULARES: readonly number[] = [1, 3, 8, 10]

/** Um carimbo solto na janela ANTERIOR (30d): faz existir período de comparação. */
export const DIA_NA_JANELA_ANTERIOR = 31

/**
 * Dias de PONTE, e eles não são decoração.
 *
 * Sem eles, uma pessoa com carimbo em 31 e em 10 tem um intervalo de 21 dias
 * entre dias distintos e vira "retomando" — o estado da §4 que exige pausa de
 * 14 dias com retorno na janela. Um cenário montado para medir REGULARIDADE
 * passaria a fabricar RETOMADAS, e o teste mediria o oposto do que pretende.
 */
export const PONTE_SEM_PAUSA: readonly number[] = [20, 12]

/**
 * 5 pessoas ativas na janela atual, 2 delas também na anterior → Δ = +3.
 * É o cenário canônico "o bloco §16 tem algo a dizer".
 */
export function cenarioAtivosMais3(periodoDias = 30): EntradaVisaoGeral {
  return cenario({
    periodoDias,
    pessoas: [
      { id: "a", sessoes: [...DIAS_REGULARES, ...PONTE_SEM_PAUSA, DIA_NA_JANELA_ANTERIOR] },
      { id: "b", sessoes: [2, 5, ...PONTE_SEM_PAUSA, DIA_NA_JANELA_ANTERIOR] },
      { id: "c", sessoes: [2] },
      { id: "d", sessoes: [3] },
      { id: "e", sessoes: [4] },
    ],
  })
}

/** Dias que fazem alguém REGULAR na janela ANTERIOR de 30 dias. */
export const DIAS_REGULARES_ANTES: readonly number[] = [31, 33, 38, 40]

/**
 * Roster de 10 com `quantos` pessoas regulares na janela ATUAL e nenhuma na
 * anterior — mas com carimbo na anterior, para existir comparação.
 */
export function cenarioRegularidadeSobe(quantos = 3): EntradaVisaoGeral {
  const pessoas: PessoaCenario[] = []
  for (let i = 0; i < 10; i++) {
    pessoas.push({
      id: `p${i}`,
      sessoes:
        i < quantos
          ? [...DIAS_REGULARES, ...PONTE_SEM_PAUSA, DIA_NA_JANELA_ANTERIOR]
          : [DIA_NA_JANELA_ANTERIOR],
    })
  }
  return cenario({ pessoas })
}

/** O espelho: regulares ANTES, ninguém regular agora. */
export function cenarioRegularidadeCai(quantos = 3): EntradaVisaoGeral {
  const pessoas: PessoaCenario[] = []
  for (let i = 0; i < 10; i++) {
    pessoas.push({
      id: `p${i}`,
      sessoes:
        i < quantos ? [...DIAS_REGULARES_ANTES, ...PONTE_SEM_PAUSA, 2] : [DIA_NA_JANELA_ANTERIOR],
    })
  }
  return cenario({ pessoas })
}

export interface DefModulo {
  id: string
  titulo: string
  /** Pessoas distintas com sessão no módulo na janela ANTERIOR. */
  antes: number
  /** Pessoas distintas com sessão no módulo na janela ATUAL. */
  agora: number
}

/** Cada módulo recebe o próprio grupo de pessoas: as contagens não se misturam. */
export function cenarioModulos(defs: readonly DefModulo[], periodoDias = 30): EntradaVisaoGeral {
  const pessoas: PessoaCenario[] = []
  const capitulos: CapituloBruto[] = []
  defs.forEach((d, ordem) => {
    capitulos.push(capitulo(d.id, d.titulo, ordem + 1))
    const total = Math.max(d.antes, d.agora)
    for (let i = 0; i < total; i++) {
      // 31 e 25 estão a 6 dias um do outro: nenhuma pessoa deste cenário vira
      // "retomando" por acidente, o que contaminaria o bloco §16.
      const offsets: number[] = []
      if (i < d.antes) offsets.push(DIA_NA_JANELA_ANTERIOR)
      if (i < d.agora) offsets.push(25)
      pessoas.push({ id: `${d.id}-p${i}`, porCapitulo: { [d.id]: offsets } })
    }
  })
  return cenario({ pessoas, capitulos, periodoDias })
}

export function capitulo(id: string, titulo: string, ordem: number): CapituloBruto {
  return { id, courseId: "c1", titulo, ordem }
}

/** Serialização usada pelos detectores (I-8, I-3). */
export function serializar(valor: unknown): string {
  return JSON.stringify(valor)
}

export function contemDigito(texto: string): boolean {
  return /\d/.test(texto)
}
