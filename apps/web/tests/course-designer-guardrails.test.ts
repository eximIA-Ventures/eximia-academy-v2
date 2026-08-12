import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * TESTE VERMELHO — POP-FIX-001, run 2026-08-12-audit-course-sem-rate-limit-declarado, Passo 2.
 *
 * O QUE ESTE TESTE MEDE, LITERALMENTE: a PRESENÇA DA INSTRUMENTAÇÃO no código-fonte
 * das rotas, e a EXISTÊNCIA de um arquivo de rota no roteamento do Next.js.
 *
 * O QUE ELE NÃO MEDE, e nenhuma linha aqui finge medir: comportamento em runtime.
 * Não há ambiente de execução das rotas disponível nesta run (sem servidor Next de
 * pé, sem Upstash Redis configurado, sem sessão Supabase real), então afirmar
 * "a 4ª auditoria na mesma hora retorna 429" seria uma alegação sem experimento por
 * trás. O modo de falha caracterizado é AUSÊNCIA DE CONTROLE, e ausência de controle
 * é observável no fonte: a rota não importa limiter nenhum e nunca chama `.limit()`.
 *
 * Critério declarado que este teste persegue (por path e linha):
 *  - docs/stories/epic-23/story-23.1-auditor-analise-curso-existente.md:68
 *      "Rate limiting: max 3 auditorias por hora por tenant"
 *  - docs/stories/epic-23/story-23.4-course-selector-caminho-b-ux.md:59
 *      "Reutilizar endpoint existente ou criar `GET /api/courses?forDesigner=true`"
 *
 * PROVA DE QUE O DETECTOR NÃO É UM `false` CONSTANTE: o bloco "controle positivo"
 * roda o MESMO detector contra as rotas irmãs que comprovadamente TÊM limiter
 * (generate, analyze-content, ai-fill, blueprints, blueprints/[blueprintId]) e exige
 * `true`. Sem esse controle, um detector quebrado (regex errada, path errado) daria
 * "ausente" para o repositório inteiro e o vermelho não provaria nada.
 *
 * `[VETO]` do POP: este arquivo NÃO corrige nada. Correção é Passo 5, depois da causa
 * raiz provada por alternância no Passo 3.
 */

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const API = join(WEB_ROOT, "src", "app", "api")

function read(relFromWebRoot: string): string {
  const abs = join(WEB_ROOT, relFromWebRoot)
  if (!existsSync(abs)) throw new Error(`arquivo inexistente: ${relFromWebRoot}`)
  return readFileSync(abs, "utf8")
}

/**
 * Detector de instrumentação de rate limit no fonte de uma rota.
 * Duas condições, ambas necessárias: importar o módulo de limiters E chamar `.limit(`.
 * Importar sem chamar é limiter morto; chamar sem importar não compila.
 */
function rateLimitInstrumentation(src: string) {
  const importsModule = /from\s+["']@\/lib\/rate-limit["']/.test(src)
  const callsLimit = /\w*[Ll]imiter\s*\.\s*limit\s*\(/.test(src)
  return { importsModule, callsLimit, instrumented: importsModule && callsLimit }
}

const AUDIT_ROUTE = "src/app/api/course-designer/audit-course/route.ts"
const APPLY_ROUTE = "src/app/api/course-designer/blueprints/[blueprintId]/apply/route.ts"

describe("controle positivo — o detector consegue devolver true", () => {
  const comLimiter = [
    "src/app/api/course-designer/generate/route.ts",
    "src/app/api/course-designer/analyze-content/route.ts",
    "src/app/api/course-designer/ai-fill/route.ts",
    "src/app/api/course-designer/blueprints/route.ts",
    "src/app/api/course-designer/blueprints/[blueprintId]/route.ts",
  ]

  it.each(comLimiter)("%s está instrumentada (baseline das irmãs)", (rel) => {
    expect(rateLimitInstrumentation(read(rel)).instrumented).toBe(true)
  })
})

describe("story-23.1 AC5 — audit-course sob rate limit por tenant", () => {
  it("audit-course/route.ts importa @/lib/rate-limit e chama .limit()", () => {
    const found = rateLimitInstrumentation(read(AUDIT_ROUTE))
    expect(
      found,
      'story-23.1:68 declara "max 3 auditorias por hora por tenant". A rota chama ' +
        "auditCourse() com gpt-4.1 sobre o conteúdo integral do curso sem controle algum.",
    ).toMatchObject({ importsModule: true, callsLimit: true })
  })

  it("existe um limiter dedicado à auditoria em lib/rate-limit.ts", () => {
    // A régua declarada é 3/hora por tenant. Nenhum dos limiters existentes tem essa
    // janela: courseDesignerGenerateLimiter é 3/10min e contentAnalysisLimiter é 5/1h.
    const src = read("src/lib/rate-limit.ts")
    expect(/export const \w*[Aa]udit\w*Limiter\b/.test(src)).toBe(true)
  })
})

describe("apply blueprint — 2 generateObject por módulo em loop, sem teto", () => {
  it("apply/route.ts importa @/lib/rate-limit e chama .limit()", () => {
    const found = rateLimitInstrumentation(read(APPLY_ROUTE))
    expect(
      found,
      "applyBlueprint() faz 2 generateObject POR MÓDULO em loop; a rota irmã " +
        "blueprints/[blueprintId]/route.ts (CRUD, barato) TEM limiter e esta, que é a cara, não.",
    ).toMatchObject({ importsModule: true, callsLimit: true })
  })
})

describe("story-23.4 AC4 — GET /api/courses consumido pelo wizard", () => {
  it("existe route.ts na raiz de api/courses (o fetch de course-selector.tsx:44)", () => {
    // Next.js App Router: `/api/courses` só existe se houver route.ts EM api/courses/.
    // api/courses/[courseId]/route.ts atende /api/courses/{id}, nunca /api/courses.
    expect(
      existsSync(join(API, "courses", "route.ts")),
      "course-selector.tsx:44 faz fetch('/api/courses?forDesigner=true') e o catch é vazio: " +
        "404 permanente vira lista vazia sem erro visível no Caminho B do wizard.",
    ).toBe(true)
  })

  it("o fetch de course-selector.tsx aponta para uma rota que existe", () => {
    const src = read("src/app/(platform)/courses/new/design/_components/course-selector.tsx")
    const rotas = [...src.matchAll(/fetch\(\s*["'](\/api\/[^"'?]+)/g)].map((m) => m[1])
    expect(rotas.length).toBeGreaterThan(0)
    const orfas = rotas.filter((r) => !existsSync(join(WEB_ROOT, "src", "app", r, "route.ts")))
    expect(orfas, "rotas chamadas pelo componente que não existem no roteamento").toEqual([])
  })
})
