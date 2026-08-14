import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * TESTE VERMELHO — POP-FIX-001, run 2026-08-12-epic23-conjunto-documental-parado, Passo 2.
 *
 * ALVO DO POP: o CONJUNTO DOCUMENTAL do Epic 23 (1 epic + 4 stories). O alvo é markdown,
 * então por POP-FIX-001 §4.1 ("Hook .cjs, skill, rule, POP") o gate é um script de asserção
 * que roda o ARTEFATO contra ENTRADA CONHECIDA. A entrada conhecida é o código-fonte ao
 * lado: cada documento afirma um estado do mundo, e o mundo está no mesmo repositório.
 *
 * O QUE ESTE TESTE MEDE, LITERALMENTE: a coerência entre as AFIRMAÇÕES VERIFICÁVEIS dos 5
 * documentos (campo `**Status:**`, caixa de AC, endereço de artefato, guarda declarada) e
 * a PRESENÇA da implementação no fonte. Ele confronta célula de documento contra arquivo,
 * símbolo e literal de código.
 *
 * O QUE ELE NÃO MEDE, e nenhuma linha aqui finge medir: comportamento em runtime. Não há
 * servidor Next de pé, nem Redis, nem sessão Supabase nesta run. "Rate limit ausente" é
 * afirmado como AUSÊNCIA DE INSTRUMENTAÇÃO NO FONTE, que é observável; não como "a 4ª
 * requisição passa", que exigiria experimento que não foi feito.
 *
 * O modo de falha caracterizado é CONJUNTO DOCUMENTAL PARADO: os documentos que governam o
 * Epic 23 congelaram no momento anterior à implementação, e erram em DUAS DIREÇÕES OPOSTAS
 * ao mesmo tempo:
 *   (A) SUBESTIMA — negam o que o código tem (Status Draft/Ready, caixas de AC desmarcadas
 *       sobre artefatos que estão em produção);
 *   (B) SUPERESTIMA — afirmam o que o código não tem (endereços de artefato em um pacote
 *       que nunca os recebeu, um controle de rate limit inexistente, uma guarda de papel
 *       mais estreita que a real, e uma rota HTTP que não existe no roteamento).
 * A distinção importa porque muda o que a correção precisa fazer em cada linha: a direção
 * (A) se corrige atualizando o documento para o real; a direção (B) NÃO se corrige por
 * documento, porque apagar a linha apagaria junto o único registro de um controle que
 * alguém decidiu que deveria existir.
 *
 * FRONTEIRA COM A RUN IRMÃ: `2026-08-12-audit-course-sem-rate-limit-declarado` carrega o
 * CÓDIGO (as rotas sem limiter, o 404 silencioso), e o teste dela é
 * `apps/web/tests/course-designer-guardrails.test.ts`. Aqui o objeto da asserção é o
 * DOCUMENTO; o fato de código é apenas o lado direito da comparação. Não é duplicação: lá
 * a pergunta é "a rota tem limiter?", aqui é "a linha que promete o limiter está de pé?".
 *
 * PROVA DE QUE OS DETECTORES NÃO SÃO CONSTANTES: o bloco "controle positivo" exige que o
 * parser de markdown extraia campos e caixas conhecidos, que o detector de arquivo devolva
 * `true` para os artefatos que comprovadamente EXISTEM, e que a story-23.3 (que acerta os
 * três endereços que declara) passe inteira no detector de endereço. Sem esse bloco, um
 * parser quebrado pintaria os 5 documentos de vermelho e o vermelho não provaria nada.
 *
 * `[VETO]` do POP: este arquivo NÃO corrige nada. Correção do documento é Passo 5, depois
 * da causa raiz provada por alternância no Passo 3.
 */

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const REPO_ROOT = join(WEB_ROOT, "..", "..")

function repoPath(rel: string): string {
  return join(REPO_ROOT, rel)
}

function exists(rel: string): boolean {
  return existsSync(repoPath(rel))
}

function read(rel: string): string {
  const abs = repoPath(rel)
  if (!existsSync(abs)) throw new Error(`arquivo inexistente: ${rel}`)
  return readFileSync(abs, "utf8")
}

/* ------------------------------------------------------------------ docs -- */

const DOC = {
  epic: "docs/epics/epic-23-ws2-integration-auditor-apply-ws1.md",
  s231: "docs/stories/epic-23/story-23.1-auditor-analise-curso-existente.md",
  s232: "docs/stories/epic-23/story-23.2-blueprint-apply-curso-capitulos-questions.md",
  s233: "docs/stories/epic-23/story-23.3-integracao-ws1-3-campos-opcionais.md",
  s234: "docs/stories/epic-23/story-23.4-course-selector-caminho-b-ux.md",
} as const

/** Extrai o valor de um campo de cabeçalho `**Chave:** valor`. */
function campo(rel: string, chave: string): string | null {
  const m = new RegExp(`^\\*\\*${chave}:\\*\\*\\s*(.+)$`, "m").exec(read(rel))
  return m ? m[1].trim() : null
}

/** Extrai o valor da célula `| **Package** | ... |` da tabela Story Context. */
function pacoteDeclarado(rel: string): string | null {
  const m = /^\|\s*\*\*Package\*\*\s*\|\s*(.+?)\s*\|\s*$/m.exec(read(rel))
  return m ? m[1].trim() : null
}

/** Estado da caixa de uma AC: "marcada" | "desmarcada" | null se a AC não existe. */
function caixaDaAC(rel: string, ac: string): "marcada" | "desmarcada" | null {
  const m = new RegExp(`^- \\[( |x)\\] \\*\\*${ac}:\\*\\*`, "m").exec(read(rel))
  if (!m) return null
  return m[1] === "x" ? "marcada" : "desmarcada"
}

/** Bloco de texto de uma AC: da linha da AC até a próxima AC (ou o fim da seção). */
function blocoDaAC(rel: string, ac: string): string {
  const texto = read(rel)
  const inicio = new RegExp(`^- \\[[ x]\\] \\*\\*${ac}:\\*\\*`, "m").exec(texto)
  if (!inicio) throw new Error(`${ac} não encontrada em ${rel}`)
  const resto = texto.slice(inicio.index + inicio[0].length)
  const fim = /^(- \[[ x]\] \*\*AC|---)/m.exec(resto)
  return inicio[0] + (fim ? resto.slice(0, fim.index) : resto)
}

/** Todo path de arquivo `.ts`/`.tsx`/`.sql` citado em crase dentro de um trecho. */
function pathsCitados(trecho: string): string[] {
  return [...trecho.matchAll(/`([^`]+\.(?:ts|tsx|sql))`/g)].map((m) => m[1])
}

/** Papéis citados em crase dentro de um trecho, na ordem de aparição. */
function papeisCitados(trecho: string): string[] {
  return [...trecho.matchAll(/`(manager|admin|super_admin|instructor)`/g)].map((m) => m[1])
}

/* ------------------------------------------------------------------ code -- */

const CODE = {
  auditorReal: "packages/agents/src/course-designer/auditor.ts",
  applyReal: "packages/agents/src/course-designer/apply-blueprint.ts",
  promptReal: "packages/agents/src/course-designer/prompts/auditor.ts",
  agentsIndex: "packages/agents/src/index.ts",
  orchestrator: "packages/agents/src/orchestrator.ts",
  chaptersSchema: "packages/database/src/schema/chapters.ts",
  migrationWs2: "supabase/migrations/20260226000000_add_ws2_fields_to_chapters.sql",
  auditRoute: "apps/web/src/app/api/course-designer/audit-course/route.ts",
  applyRoute: "apps/web/src/app/api/course-designer/blueprints/[blueprintId]/apply/route.ts",
  coursesRootRoute: "apps/web/src/app/api/courses/route.ts",
  courseSelector: "apps/web/src/app/(platform)/courses/new/design/_components/course-selector.tsx",
  scopeStep: "apps/web/src/app/(platform)/courses/new/design/_components/scope-step.tsx",
} as const

/**
 * Instrumentação de rate limit no fonte de uma rota. Duas condições, ambas necessárias:
 * importar o módulo de limiters E chamar `.limit(`. Mesmo detector da run irmã, de
 * propósito: se as duas runs discordassem sobre o fato, uma delas estaria errada.
 */
function temRateLimit(rel: string): boolean {
  const src = read(rel)
  return (
    /from\s+["']@\/lib\/rate-limit["']/.test(src) && /\w*[Ll]imiter\s*\.\s*limit\s*\(/.test(src)
  )
}

/** Papéis realmente aceitos pela guarda `[...].includes(profile.role)` de uma rota. */
function papeisAceitos(rel: string): string[] {
  const m = /\[([^\]]*)\]\s*\.includes\(\s*profile\.role\s*\)/.exec(read(rel))
  if (!m) throw new Error(`guarda de papel não encontrada em ${rel}`)
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
}

function exporta(rel: string, simbolo: string): boolean {
  return new RegExp(`\\b${simbolo}\\b`).test(read(rel))
}

/* ================================================================ CONTROLE = */

describe("controle positivo — os detectores devolvem o valor certo onde o valor é conhecido", () => {
  it("o parser lê o campo Status dos 5 documentos", () => {
    expect(campo(DOC.epic, "Status")).toBe("Draft")
    expect(campo(DOC.s231, "Status")).toBe("Ready")
    expect(campo(DOC.s232, "Status")).toBe("Ready")
    expect(campo(DOC.s233, "Status")).toBe("Ready")
    expect(campo(DOC.s234, "Status")).toBe("Ready")
  })

  it("o parser distingue caixa existente de AC inexistente", () => {
    expect(caixaDaAC(DOC.s231, "AC1")).toBe("desmarcada")
    expect(caixaDaAC(DOC.s234, "AC7")).toBeNull()
  })

  it("o parser extrai paths e papéis de dentro de um bloco de AC", () => {
    expect(pathsCitados(blocoDaAC(DOC.s231, "AC1"))).toContain(
      "packages/course-designer/src/auditor.ts",
    )
    expect(papeisCitados(blocoDaAC(DOC.s231, "AC5"))).toEqual(["manager", "admin"])
  })

  it("o detector de arquivo devolve true para os artefatos que existem", () => {
    expect(exists(CODE.auditorReal)).toBe(true)
    expect(exists(CODE.applyReal)).toBe(true)
    expect(exists(CODE.promptReal)).toBe(true)
    expect(exists(CODE.auditRoute)).toBe(true)
    expect(exists(CODE.applyRoute)).toBe(true)
    expect(exists(CODE.courseSelector)).toBe(true)
    expect(exists(CODE.migrationWs2)).toBe(true)
  })

  it("o detector de rate limit devolve true nas rotas irmãs que têm limiter", () => {
    expect(temRateLimit("apps/web/src/app/api/course-designer/generate/route.ts")).toBe(true)
    expect(temRateLimit("apps/web/src/app/api/course-designer/ai-fill/route.ts")).toBe(true)
  })

  it("story-23.3 acerta os endereços que declara — o detector de endereço não é um false constante", () => {
    // Os 3 endereços da 23.3 (migration, schema Drizzle, orquestrador) existem no real.
    expect(exists(CODE.migrationWs2)).toBe(true)
    expect(exists(CODE.chaptersSchema)).toBe(true)
    expect(exists(CODE.orchestrator)).toBe(true)
    expect(pacoteDeclarado(DOC.s233)).toContain("@eximia/agents")
  })

  it("o epic aponta o endereço CERTO do auditor, ao contrário da story-23.1", () => {
    expect(read(DOC.epic)).toContain("packages/agents/src/course-designer/auditor.ts")
  })
})

/* ============================================== A — SUBESTIMA (9 asserções) = */
/* O documento NEGA o que o código TEM.                                        */

describe("A — SUBESTIMA: o documento nega o que o código tem", () => {
  it("A1 epic-23:7 — Status Draft, mas as 4 stories filhas têm artefato em produção", () => {
    const implementado =
      exists(CODE.auditorReal) &&
      exists(CODE.applyReal) &&
      exists(CODE.migrationWs2) &&
      exists(CODE.courseSelector)
    expect(implementado).toBe(true)
    expect(campo(DOC.epic, "Status")).not.toBe("Draft")
  })

  it("A2 story-23.1:8 — Status Ready, mas auditCourse está exportado de @eximia/agents", () => {
    expect(exporta(CODE.agentsIndex, "auditCourse")).toBe(true)
    expect(campo(DOC.s231, "Status")).not.toBe("Ready")
  })

  it("A3 story-23.2:8 — Status Ready, mas applyBlueprint está exportado de @eximia/agents", () => {
    expect(exporta(CODE.agentsIndex, "applyBlueprint")).toBe(true)
    expect(campo(DOC.s232, "Status")).not.toBe("Ready")
  })

  it("A4 story-23.3:8 — Status Ready, mas a migration WS2 e o schema Drizzle estão aplicados", () => {
    expect(exists(CODE.migrationWs2)).toBe(true)
    expect(read(CODE.chaptersSchema)).toContain("interaction_type")
    expect(campo(DOC.s233, "Status")).not.toBe("Ready")
  })

  it("A5 story-23.4:8 — Status Ready, mas o CourseSelector está montado no wizard", () => {
    expect(read(CODE.scopeStep)).toContain("<CourseSelector />")
    expect(campo(DOC.s234, "Status")).not.toBe("Ready")
  })

  it("A6 story-23.1 AC1 — caixa desmarcada, mas auditCourse existe e é exportado", () => {
    expect(exists(CODE.auditorReal)).toBe(true)
    expect(exporta(CODE.agentsIndex, "auditCourse")).toBe(true)
    expect(caixaDaAC(DOC.s231, "AC1")).not.toBe("desmarcada")
  })

  it('A7 story-23.2 AC5 — caixa desmarcada, mas a rota grava status "applied" no blueprint', () => {
    expect(read(CODE.applyRoute)).toContain('status: "applied"')
    expect(caixaDaAC(DOC.s232, "AC5")).not.toBe("desmarcada")
  })

  it("A8 story-23.3 AC1 — caixa desmarcada, mas a migration das 2 colunas WS2 existe", () => {
    const sql = read(CODE.migrationWs2)
    expect(sql).toContain("interaction_type")
    expect(sql).toContain("bloom_target")
    expect(caixaDaAC(DOC.s233, "AC1")).not.toBe("desmarcada")
  })

  it("A9 story-23.4 AC1 — caixa desmarcada, mas o Course Selector existe e é importado no scope-step", () => {
    expect(exists(CODE.courseSelector)).toBe(true)
    expect(read(CODE.scopeStep)).toContain('from "./course-selector"')
    expect(caixaDaAC(DOC.s234, "AC1")).not.toBe("desmarcada")
  })
})

/* ============================================ B — SUPERESTIMA (9 asserções) = */
/* O documento AFIRMA o que o código NÃO tem.                                  */

describe("B — SUPERESTIMA: o documento afirma o que o código não tem", () => {
  it("B1 story-23.1 AC1 — declara packages/course-designer/src/auditor.ts, que não existe", () => {
    const declarado = pathsCitados(blocoDaAC(DOC.s231, "AC1"))[0]
    expect(declarado).toBe("packages/course-designer/src/auditor.ts")
    expect(exists(declarado)).toBe(true)
  })

  it("B2 story-23.1 AC6 — declara packages/course-designer/src/prompts/auditor.ts, que não existe", () => {
    const declarado = pathsCitados(blocoDaAC(DOC.s231, "AC6"))[0]
    expect(declarado).toBe("packages/course-designer/src/prompts/auditor.ts")
    expect(exists(declarado)).toBe(true)
  })

  it('B3 story-23.1 AC5 — declara "max 3 auditorias por hora por tenant", e a rota não tem limiter', () => {
    expect(blocoDaAC(DOC.s231, "AC5")).toContain("max 3 auditorias por hora por tenant")
    expect(temRateLimit(CODE.auditRoute)).toBe(true)
  })

  it("B4 story-23.1 AC5 — declara guarda de 2 papéis, e a rota aceita 4", () => {
    expect(papeisCitados(blocoDaAC(DOC.s231, "AC5"))).toEqual(["manager", "admin"])
    expect(papeisAceitos(CODE.auditRoute)).toEqual(["manager", "admin"])
  })

  it("B5 story-23.1 Story Context — declara Package @eximia/course-designer, e os artefatos vivem em @eximia/agents", () => {
    expect(pacoteDeclarado(DOC.s231)).toContain("@eximia/course-designer")
    expect(exists("packages/course-designer/src/auditor.ts")).toBe(true)
  })

  it("B6 story-23.2 AC2 — declara packages/course-designer/src/apply-blueprint.ts, que não existe", () => {
    const declarado = pathsCitados(blocoDaAC(DOC.s232, "AC2"))[0]
    expect(declarado).toBe("packages/course-designer/src/apply-blueprint.ts")
    expect(exists(declarado)).toBe(true)
  })

  it("B7 story-23.2 AC1 — declara guarda de 2 papéis, e a rota aceita 4", () => {
    expect(papeisCitados(blocoDaAC(DOC.s232, "AC1"))).toEqual(["manager", "admin"])
    expect(papeisAceitos(CODE.applyRoute)).toEqual(["manager", "admin"])
  })

  it("B8 story-23.2 Story Context — declara Package @eximia/course-designer, e os artefatos vivem em @eximia/agents", () => {
    expect(pacoteDeclarado(DOC.s232)).toContain("@eximia/course-designer")
    expect(exists("packages/course-designer/src/apply-blueprint.ts")).toBe(true)
  })

  it("B9 story-23.4 AC4 — declara GET /api/courses?forDesigner=true, e a rota não existe no roteamento", () => {
    expect(blocoDaAC(DOC.s234, "AC4")).toContain("GET /api/courses?forDesigner=true")
    // O consumidor já está no ar e chama esse endereço com catch vazio (404 silencioso).
    expect(read(CODE.courseSelector)).toContain('fetch("/api/courses?forDesigner=true")')
    expect(exists(CODE.coursesRootRoute)).toBe(true)
  })
})
