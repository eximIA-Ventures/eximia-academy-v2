/**
 * Import em massa de usuários — a parte que DECIDE, como função pura (CFG-6.1).
 *
 * ## Por que a decisão mora fora da rota
 *
 * Convidar em lote é a operação mais perigosa desta tela: um erro aqui não é uma
 * coluna torta, é um e-mail disparado para gente de verdade e contas criadas em
 * produção. A proteção escolhida é uma só e é estrutural: **a mesma função
 * classifica a pré-visualização e a aplicação**. O que o admin viu na tela e o
 * que o servidor vai criar não são dois cálculos parecidos — são a mesma
 * chamada, sobre o mesmo texto. Se fossem dois caminhos, o dia em que
 * divergissem seria o dia em que o lote criou alguém que a tela não mostrou.
 *
 * ## O que NÃO está aqui (e por que)
 *
 * Casamento por matrícula (`RESULT-usuarios2.md`, B3 da ficha corretiva) fica
 * fora: depende de coluna que não existe no schema atual, e adivinhar a pessoa
 * por nome seria fundir cadastros errados. O que existe hoje é o e-mail, que é
 * único de verdade — e é só por ele que este módulo decide.
 */

/* ------------------------------- Papéis ---------------------------------- */

/** Mesmo conjunto aceito pelo `inviteSchema` da rota — nem um a mais. */
export const IMPORT_ROLES = ["student", "leader", "manager", "admin", "instructor"] as const
export type ImportRole = (typeof IMPORT_ROLES)[number]

/** Rótulos em português aceitos na planilha, além do próprio valor técnico. */
const ROLE_ALIASES: Record<string, ImportRole> = {
  estudante: "student",
  aluno: "student",
  student: "student",
  instrutor: "instructor",
  professor: "instructor",
  instructor: "instructor",
  gestor: "manager",
  gerente: "manager",
  manager: "manager",
  administrador: "admin",
  admin: "admin",
  "lider educador": "leader",
  "líder educador": "leader",
  lider: "leader",
  líder: "leader",
  leader: "leader",
}

export const DEFAULT_IMPORT_ROLE: ImportRole = "student"

/* ------------------------------ Leitura CSV ------------------------------- */

/**
 * Cabeçalhos aceitos por coluna, JÁ na forma normalizada por `normalizeHeader`
 * (sem acento, sem caixa, sem espaço/underscore/hífen) — por isso `"e-mail"` e
 * `"full_name"` não aparecem aqui: eles chegam como `"email"` e `"fullname"`.
 */
const HEADER_ALIASES: Record<"full_name" | "email" | "role" | "report_name", string[]> = {
  full_name: ["nome", "nomecompleto", "name", "fullname"],
  email: ["email", "emails", "correio"],
  role: ["papel", "perfil", "role", "funcao"],
  report_name: ["nomepararelatorio", "nomerelatorio", "reportname"],
}

function normalizeHeader(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      // `\p{Diacritic}` em vez da faixa `\u0300-\u036f`: mesma inten\u00e7\u00e3o, sem a
      // classe de caracteres enganosa que o linter (com raz\u00e3o) reprova.
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[\s_-]/g, "")
  )
}

/**
 * Divide uma linha de CSV respeitando aspas duplas (`"Silva, Maria"`) e o par
 * `""` como aspa escapada. Aceita `,` e `;` como separador — planilha exportada
 * do Excel em pt-BR usa ponto e vírgula, e recusar isso faria o admin achar que
 * o arquivo dele está quebrado.
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === delimiter) {
      out.push(field)
      field = ""
      continue
    }
    field += char
  }
  out.push(field)
  return out.map((f) => f.trim())
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length
  const commas = (headerLine.match(/,/g) ?? []).length
  return semicolons > commas ? ";" : ","
}

export interface ParsedRow {
  /** Número da linha NO ARQUIVO (1 = cabeçalho). O admin corrige olhando isto. */
  line: number
  full_name: string
  email: string
  role: string
  report_name: string | null
}

export type ParseResult =
  | { ok: false; error: string }
  | { ok: true; rows: ParsedRow[]; delimiter: string }

/** Teto duro de linhas por lote (`finops-guardrails`: operação em massa tem parada). */
export const MAX_IMPORT_ROWS = 500

export function parseUsersCsv(text: string): ParseResult {
  // BOM do Excel quebra o primeiro cabeçalho silenciosamente.
  const clean = text.replace(/^\ufeff/, "")
  const lines = clean.split(/\r\n|\n|\r/)
  const headerIndex = lines.findIndex((l) => l.trim() !== "")

  if (headerIndex === -1) {
    return { ok: false, error: "Arquivo vazio." }
  }

  const delimiter = detectDelimiter(lines[headerIndex])
  const header = splitCsvLine(lines[headerIndex], delimiter).map(normalizeHeader)

  const columnOf = (key: keyof typeof HEADER_ALIASES) =>
    header.findIndex((h) => HEADER_ALIASES[key].includes(h))

  const emailCol = columnOf("email")
  const nameCol = columnOf("full_name")

  if (emailCol === -1) {
    return {
      ok: false,
      error: 'Cabeçalho sem coluna de e-mail. Esperado: "nome", "email" e (opcional) "papel".',
    }
  }
  if (nameCol === -1) {
    return {
      ok: false,
      error: 'Cabeçalho sem coluna de nome. Esperado: "nome", "email" e (opcional) "papel".',
    }
  }

  const roleCol = columnOf("role")
  const reportCol = columnOf("report_name")

  const rows: ParsedRow[] = []
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i]
    if (raw.trim() === "") continue // linha em branco não é erro, é ruído de planilha

    const cells = splitCsvLine(raw, delimiter)
    rows.push({
      line: i + 1,
      full_name: cells[nameCol] ?? "",
      email: cells[emailCol] ?? "",
      role: roleCol === -1 ? "" : (cells[roleCol] ?? ""),
      report_name: reportCol === -1 ? null : cells[reportCol] || null,
    })

    if (rows.length > MAX_IMPORT_ROWS) {
      return {
        ok: false,
        error: `Arquivo acima do limite de ${MAX_IMPORT_ROWS} linhas por lote. Divida em partes.`,
      }
    }
  }

  if (rows.length === 0) {
    return { ok: false, error: "Nenhuma linha de dados abaixo do cabeçalho." }
  }

  return { ok: true, rows, delimiter }
}

/* ---------------------------- Classificação ------------------------------- */

export type SkipReason = "invalid" | "duplicate_in_file" | "already_exists"

export interface CreatableRow {
  line: number
  full_name: string
  email: string
  role: ImportRole
  report_name: string | null
}

export interface SkippedRow {
  line: number
  email: string
  reason: SkipReason
  detail: string
}

export interface Classification {
  toCreate: CreatableRow[]
  skipped: SkippedRow[]
  counts: {
    total: number
    toCreate: number
    invalid: number
    duplicateInFile: number
    alreadyExists: number
  }
}

// Deliberadamente conservador: um e-mail que passe aqui e falhe no Auth vira
// erro visível na aplicação, o que é melhor que aceitar formato duvidoso.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function parseImportRole(value: string): ImportRole | null {
  const key = value.trim().toLowerCase()
  if (!key) return DEFAULT_IMPORT_ROLE
  return ROLE_ALIASES[key] ?? null
}

/**
 * Decide, linha a linha, o que será criado e o que será IGNORADO — sempre com
 * motivo. Nenhuma linha some em silêncio: `toCreate.length + skipped.length`
 * é sempre igual ao total lido.
 *
 * @param existingEmails e-mails que já existem no tenant, normalizados pelo
 * chamador. Só o servidor sabe disso, e é por isso que a pré-visualização é uma
 * ida ao servidor e não um cálculo no navegador.
 */
export function classifyImportRows(
  rows: ParsedRow[],
  existingEmails: Iterable<string>,
): Classification {
  const existing = new Set([...existingEmails].map(normalizeEmail))
  const seen = new Set<string>()
  const toCreate: CreatableRow[] = []
  const skipped: SkippedRow[] = []

  for (const row of rows) {
    const email = normalizeEmail(row.email)
    const name = row.full_name.trim()

    if (!email) {
      skipped.push({ line: row.line, email: "", reason: "invalid", detail: "E-mail em branco." })
      continue
    }
    if (!EMAIL_RE.test(email)) {
      skipped.push({ line: row.line, email, reason: "invalid", detail: "E-mail inválido." })
      continue
    }
    if (!name) {
      skipped.push({ line: row.line, email, reason: "invalid", detail: "Nome em branco." })
      continue
    }

    const role = parseImportRole(row.role)
    if (!role) {
      skipped.push({
        line: row.line,
        email,
        reason: "invalid",
        detail: `Papel não reconhecido: "${row.role.trim()}".`,
      })
      continue
    }

    if (seen.has(email)) {
      // A PRIMEIRA ocorrência já foi aceita; as demais são ignoradas, nunca
      // sobrescrevem — senão a última linha da planilha venceria em silêncio.
      skipped.push({
        line: row.line,
        email,
        reason: "duplicate_in_file",
        detail: "E-mail repetido no arquivo — vale a primeira ocorrência.",
      })
      continue
    }

    if (existing.has(email)) {
      skipped.push({
        line: row.line,
        email,
        reason: "already_exists",
        detail: "Já existe um usuário com este e-mail nesta empresa.",
      })
      continue
    }

    seen.add(email)
    toCreate.push({
      line: row.line,
      full_name: name,
      email,
      role,
      report_name: row.report_name?.trim() || null,
    })
  }

  return {
    toCreate,
    skipped,
    counts: {
      total: rows.length,
      toCreate: toCreate.length,
      invalid: skipped.filter((s) => s.reason === "invalid").length,
      duplicateInFile: skipped.filter((s) => s.reason === "duplicate_in_file").length,
      alreadyExists: skipped.filter((s) => s.reason === "already_exists").length,
    },
  }
}

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  invalid: "Linha inválida",
  duplicate_in_file: "Repetida no arquivo",
  already_exists: "Já cadastrado",
}
