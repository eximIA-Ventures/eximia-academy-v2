import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * TESTE VERMELHO — POP-FIX-001, run 2026-08-12-epic9-nega-coleta-de-employee-status, Passo 2.
 *
 * O QUE ESTE TESTE MEDE, LITERALMENTE: a CONTRADIÇÃO entre o que a cadeia documental do
 * Epic 9 declara e o que existe no código versionado deste repositório. Nada mais.
 *
 * O QUE ELE NÃO MEDE, e nenhuma linha aqui finge medir:
 *  - comportamento em runtime (não há servidor Next de pé, nem sessão Supabase);
 *  - o ESTADO DO BANCO em execução. A migration `20260209000001_epic9_courses_type.sql`
 *    existe em disco e o enum está no schema Drizzle, mas nenhuma linha aqui afirma que a
 *    coluna está aplicada no Postgres de produção. "Arquivo de migration existe" e "coluna
 *    existe no banco" são afirmações diferentes, e só a primeira é verificável offline.
 *
 * Critério declarado que este teste persegue (por path e linha):
 *  - docs/stories/epic-9/story-9.1-redesign-onboarding.md:7 e AC4  (employee_status)
 *  - docs/stories/epic-9/story-9.2-trilha-onboarding-corporativo.md:7 e AC1/AC7 (courses.type)
 *  - docs/stories/epic-9/story-9.3-hub-autoconhecimento.md:7 e AC1 (rota /perfil)
 *  - docs/epics/epic-9-onboarding-inteligente-personalizacao.md:7  ("APPROVED — QA PASS")
 *  - docs/stories/epic-9/QA_FIX_REQUEST.md:6                      ("Gate Decision: PASS")
 *
 * PROVA DE QUE OS DETECTORES NÃO SÃO CONSTANTES: o bloco "controle positivo" exige que cada
 * detector devolva os DOIS valores. O detector de realidade tem que dizer `true` para o
 * artefato real E `false` para um artefato fabricado; o contador de caixas tem que enxergar
 * caixa aberta E caixa fechada; o leitor de `Status` tem que devolver texto não vazio.
 * Sem esse bloco, um detector quebrado (regex errada, path errado) diria "não existe" para o
 * repositório inteiro, e o vermelho deste arquivo não provaria absolutamente nada.
 *
 * `[VETO]` do POP: este arquivo NÃO corrige documento nenhum. Correção é Passo 5, depois da
 * causa raiz provada por alternância no Passo 3.
 */

const TESTS_DIR = dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = join(TESTS_DIR, "..")
const REPO_ROOT = join(WEB_ROOT, "..", "..")
const APP_SRC = join(WEB_ROOT, "src")

const EPIC = "docs/epics/epic-9-onboarding-inteligente-personalizacao.md"
const S91 = "docs/stories/epic-9/story-9.1-redesign-onboarding.md"
const S92 = "docs/stories/epic-9/story-9.2-trilha-onboarding-corporativo.md"
const S93 = "docs/stories/epic-9/story-9.3-hub-autoconhecimento.md"
const QA_FIX = "docs/stories/epic-9/QA_FIX_REQUEST.md"

/* ------------------------------------------------------------------ *
 * Leitores de documento
 * ------------------------------------------------------------------ */

function readDoc(relFromRepoRoot: string): string {
  const abs = join(REPO_ROOT, relFromRepoRoot)
  if (!existsSync(abs)) throw new Error(`documento inexistente: ${relFromRepoRoot}`)
  return readFileSync(abs, "utf8")
}

/*
 * Os parsers abaixo são PUROS sobre o conteúdo do markdown. Os wrappers `*Doc` são a única
 * ponte com o disco. Essa separação existe por exigência do gate: o controle positivo tem
 * que exercitar o parser contra uma FIXTURE literal e imutável, nunca contra o estado do
 * repositório — ver o bloco "controle positivo" e a nota de correção C-2026-08-12.
 */

/** Extrai o valor literal do cabeçalho `**Status:** X`. Devolve null se o campo não existe. */
function parseStatusHeader(md: string): string | null {
  const m = md.match(/^\*\*Status:\*\*\s*(.+)$/m)
  return m ? m[1].trim() : null
}

/** Extrai o valor literal de `**Gate Decision:** X`. Devolve null se o campo não existe. */
function parseGateDecision(md: string): string | null {
  const m = md.match(/^\*\*Gate Decision:\*\*\s*(.+)$/m)
  return m ? m[1].trim() : null
}

function parseOpenBoxes(md: string): number {
  return (md.match(/^- \[ \]/gm) ?? []).length
}

function parseClosedBoxes(md: string): number {
  return (md.match(/^- \[[xX]\]/gm) ?? []).length
}

/** Devolve os ids dos critérios de aceite ainda declarados ABERTOS (`- [ ] **ACn:**`). */
function parseOpenAcceptanceCriteria(md: string): string[] {
  return [...md.matchAll(/^- \[ \] \*\*(AC\d+):/gm)].map((m) => m[1])
}

const statusHeader = (rel: string) => parseStatusHeader(readDoc(rel))
const gateDecision = (rel: string) => parseGateDecision(readDoc(rel))
const openBoxes = (rel: string) => parseOpenBoxes(readDoc(rel))
const closedBoxes = (rel: string) => parseClosedBoxes(readDoc(rel))
const openAcceptanceCriteria = (rel: string) => parseOpenAcceptanceCriteria(readDoc(rel))

/*
 * FIXTURE literal, a entrada conhecida contra a qual os parsers são calibrados.
 * Ela não vive no repositório, não é alcançada por nenhuma correção do Passo 5, e por isso
 * o controle positivo montado sobre ela vale ANTES e DEPOIS da correção.
 * Contém, de propósito, um de cada: AC aberta, AC fechada, tarefa aberta sem id de AC,
 * tarefa fechada sem id de AC, e os dois cabeçalhos.
 */
const FIXTURE_DOC = [
  "# Fixture de calibração dos parsers",
  "",
  "**Status:** EstadoDeFixture",
  "**Gate Decision:** DecisaoDeFixture",
  "",
  "- [ ] **AC1:** critério de aceite ainda ABERTO",
  "- [x] **AC2:** critério de aceite já FECHADO",
  "- [ ] tarefa aberta sem id de AC",
  "- [x] tarefa fechada sem id de AC",
  "",
].join("\n")

/** Markdown sem nenhum dos dois cabeçalhos, para o lado negativo dos parsers de cabeçalho. */
const FIXTURE_SEM_CABECALHO = "# Documento qualquer\n\nTexto sem campo de status.\n"

/* ------------------------------------------------------------------ *
 * Detectores de realidade (código versionado)
 * ------------------------------------------------------------------ */

const CODE_EXT = /\.(ts|tsx)$/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue
    const abs = join(dir, entry)
    if (statSync(abs).isDirectory()) walk(abs, out)
    else if (CODE_EXT.test(entry)) out.push(abs)
  }
  return out
}

const ALL_APP_FILES = walk(APP_SRC)

/** Conta em quantos arquivos de `apps/web/src` o identificador aparece. */
function filesMentioning(identifier: string): string[] {
  return ALL_APP_FILES.filter((abs) => readFileSync(abs, "utf8").includes(identifier))
}

function migrationExists(fileName: string): boolean {
  return existsSync(join(REPO_ROOT, "supabase", "migrations", fileName))
}

/** O enum da coluna existe no schema Drizzle? Afirma o SCHEMA, nunca o banco. */
function drizzleColumnEnumHas(schemaRel: string, column: string, value: string): boolean {
  const abs = join(REPO_ROOT, schemaRel)
  if (!existsSync(abs)) return false
  const src = readFileSync(abs, "utf8")
  const re = new RegExp(
    `${column}\\s*:\\s*text\\(\\s*"${column}"\\s*,\\s*\\{[^}]*enum:[^}]*"${value}"`,
    "s",
  )
  return re.test(src)
}

/** Uma rota do App Router só existe se houver `page.tsx` no diretório. */
function appRouteExists(relFromAppDir: string): boolean {
  return existsSync(join(APP_SRC, "app", relFromAppDir, "page.tsx"))
}

/* ------------------------------------------------------------------ *
 * Controle positivo — os detectores conseguem devolver os DOIS valores
 * ------------------------------------------------------------------ */

describe("controle positivo — nenhum detector é uma constante", () => {
  it("filesMentioning distingue identificador vivo de identificador fabricado", () => {
    expect(filesMentioning("employee_status").length).toBeGreaterThan(0)
    expect(filesMentioning("campo_fabricado_que_nao_existe_no_repo").length).toBe(0)
  })

  it("migrationExists distingue migration real de migration fabricada", () => {
    expect(migrationExists("20260209000001_epic9_courses_type.sql")).toBe(true)
    expect(migrationExists("20990101000000_migration_fabricada.sql")).toBe(false)
  })

  it("drizzleColumnEnumHas distingue valor de enum real de valor fabricado", () => {
    const schema = "packages/database/src/schema/courses.ts"
    expect(drizzleColumnEnumHas(schema, "type", "onboarding")).toBe(true)
    expect(drizzleColumnEnumHas(schema, "type", "valor_fabricado")).toBe(false)
  })

  it("appRouteExists distingue rota real de rota fabricada", () => {
    expect(appRouteExists("(platform)/perfil")).toBe(true)
    expect(appRouteExists("(platform)/perfil-fabricado")).toBe(false)
  })

  it("os parsers de cabeçalho leem o valor literal E devolvem null quando o campo falta", () => {
    expect(parseStatusHeader(FIXTURE_DOC)).toBe("EstadoDeFixture")
    expect(parseGateDecision(FIXTURE_DOC)).toBe("DecisaoDeFixture")
    expect(parseStatusHeader(FIXTURE_SEM_CABECALHO)).toBeNull()
    expect(parseGateDecision(FIXTURE_SEM_CABECALHO)).toBeNull()
  })

  it("os parsers de cabeçalho funcionam contra os 5 documentos reais, em qualquer estado", () => {
    // Ancorado no fato de o CAMPO existir, nunca no VALOR dele: sobrevive a Draft -> Done.
    for (const doc of [EPIC, S91, S92, S93]) {
      expect(statusHeader(doc), `sem **Status:** em ${doc}`).toBeTruthy()
    }
    expect(gateDecision(QA_FIX), `sem **Gate Decision:** em ${QA_FIX}`).toBeTruthy()
  })

  it("o contador de caixas enxerga aberta E fechada (senão o vermelho não prova nada)", () => {
    // Calibrado contra a FIXTURE, não contra o repositório. Uma regex quebrada de `- [x]`
    // faria toda caixa parecer aberta e a run mediria o próprio bug do detector; ancorar
    // isto em `openBoxes(S91) > 0` faria o controle depender de o repo continuar quebrado.
    expect(parseOpenBoxes(FIXTURE_DOC)).toBe(2)
    expect(parseClosedBoxes(FIXTURE_DOC)).toBe(2)
  })

  it("openAcceptanceCriteria devolve a AC aberta e NÃO devolve a fechada", () => {
    // Discriminação exata contra entrada conhecida: `AC1` está aberta e `AC2` fechada na
    // fixture, e as duas tarefas sem id de AC não podem contaminar o resultado.
    expect(parseOpenAcceptanceCriteria(FIXTURE_DOC)).toEqual(["AC1"])
    expect(parseOpenAcceptanceCriteria(FIXTURE_SEM_CABECALHO)).toEqual([])
  })

  it("openAcceptanceCriteria devolve lista bem formada nos 5 documentos reais", () => {
    // Ancorado no FORMATO (array de ids `ACn`), nunca em qual id está aberto: vale com a
    // cadeia em Draft e vale depois do Passo 5 fechar as caixas.
    for (const doc of [EPIC, S91, S92, S93, QA_FIX]) {
      const ids = openAcceptanceCriteria(doc)
      expect(Array.isArray(ids), `openAcceptanceCriteria(${doc}) não devolveu array`).toBe(true)
      for (const id of ids) expect(id).toMatch(/^AC\d+$/)
    }
  })
})

/* ------------------------------------------------------------------ *
 * A contradição — estas asserções são o VERMELHO da run
 * ------------------------------------------------------------------ */

describe("story 9.1 — a coleta de employee_status está viva e a story diz Draft", () => {
  const vivo = filesMentioning("employee_status")

  it("o campo é coletado e persistido em apps/web/src", () => {
    // Pré-condição do vermelho: se isto falhar, a premissa da run caiu e o resto é ruído.
    expect(vivo.map((p) => p.replace(`${WEB_ROOT}/`, ""))).toEqual(
      expect.arrayContaining([expect.stringContaining("app/onboarding/actions.ts")]),
    )
  })

  it("story-9.1:7 não pode declarar Draft sobre coleta de dado pessoal em produção", () => {
    expect(
      statusHeader(S91),
      `employee_status aparece em ${vivo.length} arquivo(s) de apps/web/src, incluindo
app/onboarding/actions.ts, que grava em users.profile (JSONB). Um documento em Draft nega que
a coleta exista, e é a documentação que responde por inventário de dado pessoal.`,
    ).not.toBe("Draft")
  })

  it("AC4 (employee_status em users.profile) não pode seguir declarada aberta", () => {
    expect(
      openAcceptanceCriteria(S91),
      "AC4 declara como trabalho a fazer a gravação que app/onboarding/actions.ts já executa.",
    ).not.toContain("AC4")
  })
})

describe("story 9.2 — courses.type existe em migration e schema, e a story diz Draft", () => {
  it("story-9.2:7 não pode declarar Draft com a migration e o enum em disco", () => {
    expect(migrationExists("20260209000001_epic9_courses_type.sql")).toBe(true)
    expect(
      drizzleColumnEnumHas("packages/database/src/schema/courses.ts", "type", "onboarding"),
    ).toBe(true)
    expect(
      statusHeader(S92),
      "supabase/migrations/20260209000001_epic9_courses_type.sql existe e " +
        "packages/database/src/schema/courses.ts declara enum ['regular','onboarding'].",
    ).not.toBe("Draft")
  })

  it("AC1 e AC7 (coluna type e migration) não podem seguir declaradas abertas", () => {
    const abertas = openAcceptanceCriteria(S92)
    expect(abertas).not.toContain("AC1")
    expect(abertas).not.toContain("AC7")
  })
})

describe("story 9.3 — a rota /perfil existe e a story diz Draft", () => {
  it("story-9.3:7 não pode declarar Draft com a rota renderizando em produção", () => {
    expect(appRouteExists("(platform)/perfil")).toBe(true)
    expect(
      statusHeader(S93),
      "apps/web/src/app/(platform)/perfil/page.tsx existe, com actions.ts e loading.tsx ao lado, " +
        "e 27 componentes de suporte em src/components/profile/.",
    ).not.toBe("Draft")
  })

  it("AC1 (rota /(platform)/perfil) não pode seguir declarada aberta", () => {
    expect(openAcceptanceCriteria(S93)).not.toContain("AC1")
  })
})

describe("epic-9 — 'APPROVED — QA PASS' com 100% do próprio corpo declarado pendente", () => {
  it("um epic aprovado não pode ter zero caixas fechadas em Success Criteria e DoD", () => {
    const status = statusHeader(EPIC) ?? ""
    expect(status).toMatch(/APPROVED/)
    expect(
      closedBoxes(EPIC),
      `epic-9:7 declara "${status}" e tem ${openBoxes(EPIC)} caixas abertas contra ${closedBoxes(EPIC)}
fechadas. Aprovação e corpo integralmente pendente não coexistem: uma das duas afirmações
do documento é falsa.`,
    ).toBeGreaterThan(0)
  })
})

describe("QA_FIX_REQUEST — gate PASS concedido sobre stories que nunca saíram de Draft", () => {
  it("as 3 stories cobertas pelo gate não podem estar em Draft com o gate em PASS", () => {
    const gate = gateDecision(QA_FIX) ?? ""
    expect(gate).toMatch(/PASS/)
    const emDraft = [S91, S92, S93].filter((doc) => statusHeader(doc) === "Draft")
    expect(
      emDraft,
      `QA_FIX_REQUEST.md:6 declara "${gate}", e ainda tem ${openBoxes(QA_FIX)} itens próprios
abertos (linhas 119 a 122). Um gate PASS não fecha sobre story em Draft.`,
    ).toEqual([])
  })
})
