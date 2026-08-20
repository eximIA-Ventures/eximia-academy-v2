import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * TESTE VERMELHO — POP-FIX-001, run 2026-08-12-epic6-declara-rate-limiting-inexistente, Passo 2.
 *
 * ALVO SOB ASSERÇÃO: docs/epics/epic-6-simplificacao-seguranca.md.
 * É um documento markdown, então o comando de gate vem da §4.1 do POP, linha
 * "Hook .cjs, skill, rule, POP" → script de asserção que roda o artefato contra
 * ENTRADA CONHECIDA. A entrada conhecida aqui é o próprio repositório: cada
 * afirmação do documento é confrontada com a medição do código em disco.
 *
 * O QUE ESTE TESTE MEDE, LITERALMENTE: a CONCORDÂNCIA entre o que o epic-6 declara
 * sobre o estado da plataforma e o que o repositório contém. Ele falha enquanto o
 * documento afirmar ausência de um controle que existe.
 *
 * O QUE ELE NÃO MEDE, e nenhuma linha aqui finge medir: se o rate limiting FUNCIONA
 * em runtime (não há Upstash Redis configurado nesta run, e o middleware falha aberto
 * de propósito quando o Redis some). Afirmar "a 11ª mensagem retorna 429" seria
 * alegação sem experimento. O modo de falha caracterizado é DIVERGÊNCIA DOCUMENTAL,
 * e divergência documental é observável no par (texto do doc, fonte do repo).
 *
 * PROVA DE QUE OS DETECTORES NÃO SÃO CONSTANTES: o bloco "controle positivo" roda os
 * MESMOS extratores e as MESMAS sondas de código contra casos de resultado conhecido
 * e oposto — linhas do documento que continuam VERDADEIRAS, stories-filhas que estão
 * consistentes, e sondas apontadas para símbolos e rotas que comprovadamente NÃO
 * existem. Sem esse controle, um extrator quebrado (regex errada, path errado)
 * acusaria divergência no repositório inteiro e o vermelho não provaria nada.
 *
 * `[VETO]` do POP: este arquivo NÃO corrige o documento. Correção é Passo 5, depois
 * da causa raiz provada por alternância no Passo 3.
 */

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const REPO_ROOT = join(WEB_ROOT, "..", "..")

const EPIC_6 = "docs/epics/epic-6-simplificacao-seguranca.md"
const STORIES_6 = [
  "docs/stories/epic-6/story-6.1-remover-dual-mode-backend.md",
  "docs/stories/epic-6/story-6.2-remover-dual-mode-frontend.md",
  "docs/stories/epic-6/story-6.3-rate-limiting.md",
  "docs/stories/epic-6/story-6.4-endpoints-lgpd.md",
]

function readRepo(relFromRepoRoot: string): string {
  const abs = join(REPO_ROOT, relFromRepoRoot)
  if (!existsSync(abs)) throw new Error(`arquivo inexistente: ${relFromRepoRoot}`)
  return readFileSync(abs, "utf8")
}

/* ------------------------------------------------------------- extratores --- */

/**
 * Devolve o conteúdo da 2ª célula da linha de tabela cujo rótulo (1ª célula) casa.
 * Cobre tanto `| **Rate Limiting** | ... |` quanto `| API abuse (chat flooding) | ... |`.
 *
 * O split ignora pipe ESCAPADO (`\|`), que o markdown usa dentro de célula. A 1ª versão
 * deste extrator partia em todo `|` e truncava a célula "Dual-Mode Atual" no meio de
 * `("university" \| "corporate")`, o que fazia a asserção correspondente passar em
 * verde por cegueira do detector, não por acordo do documento com o repositório. O
 * controle positivo abaixo fixa esse caso.
 */
function cellByLabel(doc: string, label: string): string | null {
  for (const line of doc.split("\n")) {
    if (!line.trimStart().startsWith("|")) continue
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/(?<!\\)\|$/, "")
      .split(/(?<!\\)\|/)
    if (cells.length < 2) continue
    const head = cells[0].replace(/\*\*/g, "").trim()
    if (head === label) return cells[1].trim()
  }
  return null
}

/** Campo `**Status:** X` do cabeçalho do documento. */
function statusField(doc: string): string | null {
  const m = doc.match(/^\*\*Status:\*\*\s*(.+)$/m)
  return m ? m[1].trim() : null
}

function countChecklist(doc: string) {
  const abertos = (doc.match(/^- \[ \]/gm) || []).length
  const fechados = (doc.match(/^- \[x\]/gim) || []).length
  return { abertos, fechados }
}

/* ------------------------------------------- sondas do estado real do código --- */

/** Um limiter só conta se for EXPORTADO em lib/rate-limit.ts E aplicado no middleware. */
function limiterVivo(nome: string): boolean {
  const lib = readRepo("apps/web/src/lib/rate-limit.ts")
  const mw = readRepo("apps/web/src/middleware.ts")
  const exportado = new RegExp(`export const ${nome}\\b`).test(lib)
  const aplicado = new RegExp(`checkLimit\\(\\s*${nome}\\b`).test(mw)
  return exportado && aplicado
}

function rotaExiste(relFromRepoRoot: string): boolean {
  return existsSync(join(REPO_ROOT, relFromRepoRoot))
}

/** Símbolos que a Story 6.1/6.2 prometeu erradicar do código de aplicação. */
function ocorrenciasDualMode(): number {
  const alvos = [
    "packages/shared/src/types/models.ts",
    "packages/shared/src/constants/labels.ts",
    "apps/web/src/components/layout/sidebar.tsx",
  ].filter((p) => existsSync(join(REPO_ROOT, p)))
  const re = /\bTenantMode\b|\bgetModeLabels\b|\bdual-mode-labels\b/
  return alvos.filter((p) => re.test(readRepo(p))).length
}

/* ================================ CONTROLE POSITIVO ========================== */

describe("controle positivo — extratores e sondas conseguem devolver o resultado oposto", () => {
  const doc = readRepo(EPIC_6)

  it("cellByLabel encontra uma linha que continua VERDADEIRA (Cross-tenant access)", () => {
    // A própria tabela de vulnerabilidades tem linhas ainda corretas. Se o extrator
    // só soubesse achar as erradas, ele estaria enviesado pelo resultado desejado.
    expect(cellByLabel(doc, "Cross-tenant access")).toBe("RLS enforced")
  })

  it("cellByLabel devolve null para rótulo inexistente (não inventa célula)", () => {
    expect(cellByLabel(doc, "Rotulo Que Nao Existe No Documento")).toBeNull()
  })

  it("cellByLabel não trunca célula com pipe escapado (o furo que dava verde falso)", () => {
    // `| **Dual-Mode Atual** | `tenant.mode` ("university" \| "corporate") permeia ~35-40 ... |`
    // Um split ingênuo em `|` devolveria só `` `tenant.mode` ("university" \ ``.
    expect(cellByLabel(doc, "Dual-Mode Atual")).toMatch(/permeia ~35-40 arquivos/)
  })

  it("statusField lê o campo de cabeçalho de um artefato consistente", () => {
    expect(statusField(readRepo(STORIES_6[2]))).toBe("Ready for Review")
  })

  it("countChecklist devolve zero-aberto para as 4 stories-filhas (pode acusar consistência)", () => {
    for (const s of STORIES_6) {
      const { abertos, fechados } = countChecklist(readRepo(s))
      expect({ story: s, abertos }, `${s} deveria estar com todos os checkboxes fechados`).toEqual({
        story: s,
        abertos: 0,
      })
      expect(fechados).toBeGreaterThan(0)
    }
  })

  it("limiterVivo devolve false para um limiter que não existe", () => {
    expect(limiterVivo("limiterQueNaoExiste")).toBe(false)
  })

  it("rotaExiste devolve false para uma rota que não existe", () => {
    expect(rotaExiste("apps/web/src/app/api/rota-que-nao-existe/route.ts")).toBe(false)
  })
})

/* ================================== VERMELHO ================================= */

describe("epic-6 Epic Context — declara ausente o controle que está vivo", () => {
  const doc = readRepo(EPIC_6)

  it('linha "Rate Limiting" não pode dizer "Nenhum" com 6 limiters aplicados no middleware', () => {
    const vivos = [
      "authLimiter",
      "catchAllLimiter",
      "chatLimiter",
      "courseCreateLimiter",
      "privacyLimiter",
      "questionGenLimiter",
    ].filter(limiterVivo)

    const celula = cellByLabel(doc, "Rate Limiting")
    expect(
      { celula, limitersVivos: vivos.length },
      "epic-6:24 é a descrição autoritativa da postura de segurança. Quem modela ameaça " +
        "por ela revisa uma superfície desprotegida que não existe mais desde a Story 6.3.",
    ).toMatchObject({ limitersVivos: 6 })
    expect(celula).not.toMatch(/^Nenhum/)
  })

  it('linha "LGPD" não pode dizer "Sem endpoints" com export e delete em disco', () => {
    const rotas = [
      "apps/web/src/app/api/privacy/export/route.ts",
      "apps/web/src/app/api/privacy/delete/route.ts",
    ]
    expect(rotas.filter(rotaExiste)).toEqual(rotas)
    expect(
      cellByLabel(doc, "LGPD"),
      "epic-6:25 declara NFR5 não atendido; as duas rotas da Story 6.4 estão em disco.",
    ).not.toMatch(/Sem endpoints/)
  })

  it('linha "Dual-Mode Atual" não pode dizer "~35-40 arquivos" com zero ocorrências', () => {
    expect(ocorrenciasDualMode()).toBe(0)
    expect(
      cellByLabel(doc, "Dual-Mode Atual"),
      "epic-6:23 dimensiona um refactor já executado pelas Stories 6.1 e 6.2.",
    ).not.toMatch(/35-40 arquivos/)
  })
})

describe("epic-6 Current Vulnerability Assessment — 4 linhas negam controles vivos", () => {
  const doc = readRepo(EPIC_6)

  const casos: Array<[string, string, () => boolean, string]> = [
    ["API abuse (chat flooding)", "None", () => limiterVivo("chatLimiter"), "middleware.ts:227"],
    ["Brute-force auth", "None", () => limiterVivo("authLimiter"), "middleware.ts:186"],
    [
      "LGPD data request (DSAR)",
      "No endpoint",
      () => rotaExiste("apps/web/src/app/api/privacy/export/route.ts"),
      "api/privacy/export/route.ts",
    ],
    [
      "LGPD right to erasure",
      "No endpoint",
      () => rotaExiste("apps/web/src/app/api/privacy/delete/route.ts"),
      "api/privacy/delete/route.ts",
    ],
  ]

  it.each(casos)(
    'linha "%s" declara "%s" e o controle existe',
    (label, declaradoAusente, sonda, onde) => {
      expect(sonda(), `o controle citado deveria estar em ${onde}`).toBe(true)
      expect(
        cellByLabel(doc, label),
        `a coluna "Current Protection" diz "${declaradoAusente}" enquanto ${onde} existe`,
      ).not.toBe(declaradoAusente)
    },
  )
})

describe("epic-6 cabeçalho e checklist — o épico não acompanhou as stories-filhas", () => {
  const doc = readRepo(EPIC_6)

  it("Status do épico não pode ser Draft com as 4 stories em Ready for Review", () => {
    const filhas = STORIES_6.map((s) => statusField(readRepo(s)))
    expect(filhas).toEqual([
      "Ready for Review",
      "Ready for Review",
      "Ready for Review",
      "Ready for Review",
    ])
    expect(statusField(doc), "epic-6:7").not.toBe("Draft")
  })

  it("checklist do épico não pode ter 62 itens abertos com as filhas 100% fechadas", () => {
    const filhas = STORIES_6.map((s) => countChecklist(readRepo(s)))
    expect(filhas.reduce((n, c) => n + c.abertos, 0)).toBe(0)
    expect(filhas.reduce((n, c) => n + c.fechados, 0)).toBeGreaterThan(100)

    const epico = countChecklist(doc)
    expect(
      epico,
      "49 AC + 6 Compatibility + 7 Definition of Done, todos abertos, espelhando ACs que a " +
        "story-filha correspondente já marcou. A informação existe; nunca subiu para o épico.",
    ).toMatchObject({ abertos: 0 })
  })
})
