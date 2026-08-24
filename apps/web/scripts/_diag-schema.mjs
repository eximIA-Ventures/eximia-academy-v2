// ---------------------------------------------------------------------------
// Diagnóstico de schema pro backend de "Aprendizagem do Time" — roda uma vez,
// direto contra o Supabase real, e reporta o que existe de verdade: slugs de
// tenant, tabelas presentes, colunas que as Telas 2/3 passaram a consultar
// nesta sessão (concept_id, concepts.*, users.*, courses.*) sem nunca terem
// sido testadas contra o schema real.
//
// USO: node scripts/_diag-schema.mjs
// Exige SUPABASE_SERVICE_ROLE_KEY em apps/web/.env.local (não commitado).
// Script temporário — apagar depois de fechar o elo 4.
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

function lerEnvLocal() {
  const texto = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  const env = {}
  for (const linha of texto.split("\n")) {
    const m = linha.match(/^([A-Z_0-9]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

const env = lerEnvLocal()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const chave = env.SUPABASE_SERVICE_ROLE_KEY

if (!url) {
  console.error("[diag] FALHOU: NEXT_PUBLIC_SUPABASE_URL não está em apps/web/.env.local")
  process.exit(1)
}
if (!chave) {
  console.error(
    "[diag] SUPABASE_SERVICE_ROLE_KEY ainda não está em apps/web/.env.local — nada a fazer.",
  )
  console.error("[diag] Adicione a chave e rode de novo: node scripts/_diag-schema.mjs")
  process.exit(1)
}

const db = createClient(url, chave, { auth: { persistSession: false } })

function linha(ok, texto) {
  console.log(`  ${ok ? "✅" : "❌"} ${texto}`)
}

async function checarTabela(nome, colunas) {
  const { data, error, count } = await db
    .from(nome)
    .select(colunas.join(","), { count: "exact", head: false })
    .limit(1)
  if (error) {
    linha(false, `${nome} (${colunas.join(", ")}) — ${error.code ?? ""} ${error.message}`)
    return { existe: false, linhas: 0 }
  }
  linha(true, `${nome} — ${count ?? "?"} linhas, colunas ${colunas.join("/")} OK`)
  return { existe: true, linhas: count ?? 0, amostra: data?.[0] }
}

console.log("\n=== 1. Tenants ===")
{
  const { data, error } = await db.from("tenants").select("id, slug").limit(20)
  if (error) {
    linha(false, `select id, slug from tenants — ${error.message}`)
  } else {
    console.log(`  ${data.length} tenant(s):`)
    for (const t of data) console.log(`    - slug="${t.slug}" id=${t.id}`)
    const configPath = new URL("../tenant.config.ts", import.meta.url)
    const config = readFileSync(configPath, "utf8")
    const slugConfigurado = config.match(/slug:\s*"([^"]+)"/)?.[1]
    const bate = data.some((t) => t.slug === slugConfigurado)
    linha(
      bate,
      `tenant.config.ts tem slug="${slugConfigurado}" — ${bate ? "existe na tabela" : "NÃO existe na tabela, motor vai falhar com SEM_TENANT"}`,
    )
  }
}

console.log("\n=== 2. Tabelas do domínio Aprendizagem (Entrega 1) ===")
await checarTabela("capabilities", [
  "id",
  "course_id",
  "title",
  "slug",
  "is_active",
  "display_order",
])
await checarTabela("concepts", [
  "id",
  "course_id",
  "chapter_id",
  "title",
  "is_active",
  "display_order",
])
await checarTabela("capability_concepts", ["capability_id", "concept_id"])
await checarTabela("capability_criteria", ["id", "capability_id", "code", "description"])
await checarTabela("capability_evidence", [
  "id",
  "student_id",
  "capability_id",
  "concept_id",
  "evidence_category",
  "comprehension",
  "depth_level",
  "application_level",
  "occurred_at",
])
await checarTabela("capability_assessments", [
  "id",
  "student_id",
  "capability_id",
  "new_state",
  "is_current",
  "created_at",
])
await checarTabela("capability_assessment_evidence", ["assessment_id", "evidence_id"])
await checarTabela("capability_assessment_criteria", ["assessment_id", "criterion_id", "met"])

console.log("\n=== 3. Roster (users) — usado pela Tela 3 (§33) ===")
await checarTabela("users", ["id", "tenant_id", "full_name", "report_name", "role", "deleted_at"])

console.log("\n=== 4. Curso-alvo (courses) — usado pelas Telas 2/3 no modo motor ===")
{
  const r = await checarTabela("courses", ["id", "tenant_id", "title"])
  if (r.existe) {
    const { data, error } = await db
      .from("courses")
      .select("id, title")
      .eq("title", "Análise e Solução de Problemas")
    if (error) linha(false, `busca por título — ${error.message}`)
    else
      linha(
        data.length > 0,
        `curso "Análise e Solução de Problemas" — ${data.length > 0 ? `encontrado (id=${data[0].id})` : "NÃO encontrado"}`,
      )
  }
}

console.log("\n=== 5. Volume de dado real (capability_evidence, capability_assessments) ===")
{
  const { count: evidCount } = await db
    .from("capability_evidence")
    .select("*", { count: "exact", head: true })
  const { count: assessCount } = await db
    .from("capability_assessments")
    .select("*", { count: "exact", head: true })
  console.log(`  capability_evidence: ${evidCount ?? "?"} linhas`)
  console.log(`  capability_assessments: ${assessCount ?? "?"} linhas`)
  if ((evidCount ?? 0) === 0) {
    console.log(
      "  ⚠ zero evidências — as telas vão renderizar corretamente, mas em estado VAZIO (amostra insuficiente).",
    )
    console.log("    Isso não é erro de schema. É ausência de dado classificado.")
  }
}

console.log("\n[diag] fim.\n")
