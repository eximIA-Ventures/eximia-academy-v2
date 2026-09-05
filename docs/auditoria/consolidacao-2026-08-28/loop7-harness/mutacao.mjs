// Mutação: um harness verde só vale se reprovar quando o alvo é sabotado.
// Cada mutante remove UMA correção da migration e exige que algo quebre.
// Além disso, roda o PAR OBSOLETO nos dois terrenos para confirmar a premissa
// da auditoria com o mesmo instrumento.

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import { PGlite } from "@electric-sql/pglite"

const DIR = "/Users/hugocapitelli/Dev/eximia/eximia-academy-v2/supabase/migrations"
const MIGRATION = readFileSync(`${DIR}/20260828120000_aprendizagem_time_convergencia.sql`, "utf8")
// Os corpos obsoletos vêm do git (d2b8083 = HEAD antes da neutralização), para
// que a confirmação da premissa continue reproduzível depois de neutralizados.
const doGit = (f) => execFileSync("git", ["show", `d2b8083:supabase/migrations/${f}`],
  { cwd: "/Users/hugocapitelli/Dev/eximia/eximia-academy-v2", encoding: "utf8" })
const OBSOLETA_1 = doGit("20260821000000_aprendizagem_time_schema.sql")
const OBSOLETA_2 = doGit("20260825220000_aprendizagem_time_reconciliacao.sql")

const AQUI = dirname(fileURLToPath(import.meta.url))
const h = readFileSync(resolve(AQUI, "harness.mjs"), "utf8")
const bloco = (nome) => h.split(`const ${nome} = \``)[1].split("\n`")[0]
const BASE = bloco("BASE")
const TERRENO_OCUPADO = bloco("TERRENO_OCUPADO")
const DADO_LEGADO = bloco("DADO_LEGADO")
const UPSERT = bloco("UPSERT_PIPELINE")

const falhas = []
const espera = (cond, msg) => {
  console.log(`  ${cond ? "PASS" : "FALHA"}  ${msg}`)
  if (!cond) falhas.push(msg)
}

async function montar(ocupado) {
  const db = await PGlite.create()
  await db.exec(BASE)
  // As migrations OBSOLETAS usam `has_role()`, helper que as policies vivas de
  // produção não usam. Sem este stub, elas falhariam por artefato do andaime e
  // não pelo defeito real — o que invalidaria a confirmação da premissa.
  await db.exec(
    "CREATE FUNCTION public.has_role(uuid, text) RETURNS boolean LANGUAGE sql STABLE AS $fn$ SELECT false $fn$;",
  )
  if (ocupado) {
    await db.exec(TERRENO_OCUPADO)
    await db.exec(DADO_LEGADO)
  } else {
    await db.exec(`
      INSERT INTO public.tenants (id, slug) VALUES ('11111111-1111-1111-1111-111111111111','novo');
      INSERT INTO public.courses (id, tenant_id, title) VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Análise e Solução de Problemas');
      INSERT INTO public.chapters (id, course_id) VALUES ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222');
      INSERT INTO public.users (id, tenant_id) VALUES ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111');`)
  }
  return db
}

async function tentarUpsert(db) {
  const aluno = (await db.query("SELECT id FROM public.users LIMIT 1")).rows[0].id
  const cap = (await db.query("SELECT id, course_id FROM public.capabilities LIMIT 1")).rows[0]
  await db.query(UPSERT, [
    "11111111-1111-1111-1111-111111111111", aluno, cap.course_id, cap.id,
    "66666666-6666-6666-6666-666666666666",
  ])
}

// --------------------------------------------------------------------------
console.log("=".repeat(72))
console.log("PARTE 1 — o par OBSOLETO, nos dois terrenos (confirmação da premissa)")
console.log("=".repeat(72))

for (const ocupado of [true, false]) {
  const rotulo = ocupado ? "OCUPADO" : "VIRGEM"
  const db = await montar(ocupado)
  let erro1 = null
  try { await db.exec(OBSOLETA_1) } catch (e) { erro1 = e.message }
  if (ocupado) {
    espera(erro1 !== null, `terreno ${rotulo}: 20260821000000 FALHA — ${erro1?.slice(0, 90)}`)
  } else {
    espera(erro1 === null, `terreno ${rotulo}: 20260821000000 passa — ${erro1 ?? "sem erro"}`)
    let erro2 = null
    try { await db.exec(OBSOLETA_2) } catch (e) { erro2 = e.message }
    espera(erro2 !== null, `terreno ${rotulo}: 20260825220000 FALHA — ${erro2?.slice(0, 90)}`)
  }
  await db.close()
}

// --------------------------------------------------------------------------
console.log(`\n${"=".repeat(72)}`)
console.log("PARTE 1b — os 4 bloqueios independentes do upsert, ANTES da migration")
console.log("=".repeat(72))
{
  const db = await montar(true)
  const aluno = (await db.query("SELECT id FROM public.users LIMIT 1")).rows[0].id
  const cap = (await db.query("SELECT id, course_id FROM public.capabilities LIMIT 1")).rows[0]
  const t = "11111111-1111-1111-1111-111111111111"

  let e1 = null
  try { await db.query("SELECT source_table FROM public.capability_evidence LIMIT 1") } catch (e) { e1 = e.message }
  espera(/source_table/.test(e1 ?? ""), `42703 — coluna source_table não existe: ${e1?.slice(0, 60)}`)

  let e2 = null
  try {
    await db.query(
      `INSERT INTO public.capability_evidence (tenant_id, student_id, capability_id, criterion_id, course_id, category, source_type, source_id, observed_at)
       VALUES ($1,$2,$3,(SELECT id FROM public.capability_criteria LIMIT 1),$4,'cognitiva','reflection',gen_random_uuid(), now())`,
      [t, aluno, cap.id, cap.course_id])
  } catch (e) { e2 = e.message }
  espera(/source_type_check|violates check/i.test(e2 ?? ""),
    `23514 — vocabulário EN 'reflection' rejeitado pelo CHECK vivo (PT): ${e2?.slice(0, 70)}`)

  let e3 = null
  try {
    await db.query(
      `INSERT INTO public.capability_evidence (tenant_id, student_id, capability_id, course_id, category, source_type, observed_at)
       VALUES ($1,$2,$3,$4,'cognitiva','reflexao', now())`,
      [t, aluno, cap.id, cap.course_id])
  } catch (e) { e3 = e.message }
  espera(/criterion_id/.test(e3 ?? ""), `23502 — criterion_id NOT NULL sem valor no payload: ${e3?.slice(0, 60)}`)

  const uidx = (await db.query(
    "SELECT count(*)::int AS n FROM pg_class WHERE relname='capability_evidence_source_capability_uidx'")).rows[0].n
  espera(uidx === 0, "o árbitro do ON CONFLICT não existe no terreno vivo")
  await db.close()
}

console.log(`\n${"=".repeat(72)}`)
console.log("PARTE 2 — mutantes da migration nova (o harness tem que reprovar)")
console.log("=".repeat(72))

const mutantes = [
  {
    nome: "M1 — árbitro volta a ser PARCIAL (o defeito 42P10 original)",
    aplicar: (sql) => sql.replace(
      "CREATE UNIQUE INDEX IF NOT EXISTS capability_evidence_source_capability_uidx\n  ON public.capability_evidence (source_table, source_id, capability_id);",
      "CREATE UNIQUE INDEX IF NOT EXISTS capability_evidence_source_capability_uidx\n  ON public.capability_evidence (source_table, source_id, capability_id)\n  WHERE capability_id IS NOT NULL;",
    ),
  },
  {
    nome: "M2 — sem relaxar NOT NULL de category/observed_at/criterion_id",
    aplicar: (sql) => sql
      .replace("ALTER TABLE public.capability_evidence ALTER COLUMN criterion_id DROP NOT NULL;", "")
      .replace("ALTER TABLE public.capability_evidence ALTER COLUMN category     DROP NOT NULL;", "")
      .replace("ALTER TABLE public.capability_evidence ALTER COLUMN observed_at  DROP NOT NULL;", ""),
  },
  {
    nome: "M3 — sem ampliar o CHECK de source_type (pipeline escreve em EN)",
    aplicar: (sql) => sql.replace(
      "ALTER TABLE public.capability_evidence DROP CONSTRAINT IF EXISTS capability_evidence_source_type_check;",
      "",
    ),
  },
  {
    nome: "M4 — backfill de slug pela conversão mecânica (o mapa explícito some)",
    aplicar: (sql) => sql.replace(
      /SET slug = CASE code[\s\S]*?END\n WHERE slug IS NULL AND code IS NOT NULL;/,
      "SET slug = replace(code, '_', '-')\n WHERE slug IS NULL AND code IS NOT NULL;",
    ),
  },
]

for (const m of mutantes) {
  const sql = m.aplicar(MIGRATION)
  if (sql === MIGRATION) { espera(false, `${m.nome}: a mutação NÃO alterou o arquivo (padrão não casou)`); continue }
  const db = await montar(true)
  let sintoma = null
  try {
    await db.exec(sql)
    try { await tentarUpsert(db) } catch (e) { sintoma = `upsert: ${e.message}` }
    if (!sintoma && m.nome.startsWith("M4")) {
      const s = (await db.query("SELECT slug FROM public.capabilities WHERE code='clareza_fenomeno'")).rows[0].slug
      if (s !== "clareza-do-fenomeno") sintoma = `slug divergente do que o seed pressupõe: '${s}'`
    }
  } catch (e) {
    sintoma = `migration: ${e.message}`
  }
  espera(sintoma !== null, `${m.nome} → ${sintoma ? sintoma.slice(0, 110) : "NADA QUEBROU (harness cego)"}`)
  await db.close()
}

console.log(`\n${"=".repeat(72)}`)
if (falhas.length === 0) console.log("VEREDITO: premissa confirmada e todos os mutantes foram detectados.")
else { console.log(`VEREDITO: ${falhas.length} problema(s):`); for (const f of falhas) console.log(`  - ${f}`); process.exitCode = 1 }

// --------------------------------------------------------------------------
console.log(`\n${"=".repeat(72)}`)
console.log("PARTE 3 — a SEQUÊNCIA COMPLETA em ordem de timestamp (o que `db push` faria)")
console.log("=".repeat(72))

const SEQUENCIA = [
  "20260821000000_aprendizagem_time_schema.sql",
  "20260821010000_aprendizagem_time_seed_analise_problemas.sql",
  "20260825220000_aprendizagem_time_reconciliacao.sql",
  "20260828120000_aprendizagem_time_convergencia.sql",
].map((f) => [f, readFileSync(`${DIR}/${f}`, "utf8")])

for (const ocupado of [false, true]) {
  const rotulo = ocupado ? "OCUPADO" : "VIRGEM"
  const db = await montar(ocupado)
  let erro = null
  for (const [nome, sql] of SEQUENCIA) {
    try { await db.exec(sql) } catch (e) { erro = `${nome}: ${e.message}`; break }
  }
  espera(erro === null, `terreno ${rotulo}: as 4 migrations rodam em ordem — ${erro ?? "sem erro"}`)
  if (!erro) {
    const n = (await db.query(`SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN ('concepts','capabilities','capability_concepts',
      'capability_criteria','capability_evidence','capability_assessments',
      'capability_assessment_evidence','capability_assessment_criteria')`)).rows[0].n
    espera(n === 8, `terreno ${rotulo}: estado final tem as 8 tabelas (${n}/8)`)
    try { await tentarUpsert(db); espera(true, `terreno ${rotulo}: upsert do pipeline grava ao fim da sequência`) }
    catch (e) { espera(false, `terreno ${rotulo}: upsert falhou ao fim da sequência — ${e.message}`) }
  }
  await db.close()
}

console.log(`\n${"=".repeat(72)}`)
if (falhas.length === 0) console.log("VEREDITO FINAL: premissa confirmada, mutantes detectados, sequência completa verde nos dois terrenos.")
else { console.log(`VEREDITO FINAL: ${falhas.length} problema(s).`); process.exitCode = 1 }
