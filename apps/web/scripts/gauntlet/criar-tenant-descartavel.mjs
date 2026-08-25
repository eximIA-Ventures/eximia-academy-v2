// ===========================================================================
// Cria o tenant descartável — ato DELIBERADO, arquivo separado de propósito.
//
// O semeador não cria tenant. Este script cria, e só ele. A separação existe
// porque um semeador que cria o que não encontra transforma um erro de
// digitação no slug em um tenant novo dentro do banco de produção de um
// cliente — silenciosamente, e com nome parecido o bastante para ninguém
// notar por semanas.
//
// Idempotente: rodar duas vezes não duplica nem altera nada.
//
//   node apps/web/scripts/gauntlet/criar-tenant-descartavel.mjs
//   node apps/web/scripts/gauntlet/criar-tenant-descartavel.mjs --remover
// ===========================================================================

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { SLUG_DESCARTAVEL, SLUGS_PROIBIDOS, TravaViolada } from "./trava-de-tenant.mjs"

const AQUI = dirname(fileURLToPath(import.meta.url))
const WEB = resolve(AQUI, "../..")

function lerEnv() {
  const texto = readFileSync(resolve(WEB, ".env.local"), "utf8")
  return Object.fromEntries(
    texto
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=")
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
      }),
  )
}

const env = lerEnv()
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const remover = process.argv.includes("--remover")

// Guarda final: o slug que este arquivo escreve é constante e não pode ser
// nenhum dos reais. Checado em tempo de execução, não só na revisão.
if (SLUGS_PROIBIDOS.includes(SLUG_DESCARTAVEL)) {
  throw new TravaViolada(`o slug descartável colide com um tenant real: "${SLUG_DESCARTAVEL}".`)
}

const { data: existente, error: erroBusca } = await db
  .from("tenants")
  .select("id,slug,name")
  .eq("slug", SLUG_DESCARTAVEL)
  .maybeSingle()

if (erroBusca) {
  console.error(`[tenant] falha ao consultar: ${erroBusca.message}`)
  process.exit(1)
}

if (remover) {
  if (!existente) {
    console.log(`[tenant] "${SLUG_DESCARTAVEL}" já não existe. Nada a fazer.`)
    process.exit(0)
  }
  if (existente.slug !== SLUG_DESCARTAVEL) {
    console.error(`[tenant] recusa: o alvo é "${existente.slug}".`)
    process.exit(1)
  }
  const { error } = await db.from("tenants").delete().eq("id", existente.id)
  if (error) {
    console.error(`[tenant] falha ao remover: ${error.message}`)
    process.exit(1)
  }
  console.log(`[tenant] removido "${SLUG_DESCARTAVEL}" (${existente.id}).`)
  process.exit(0)
}

if (existente) {
  console.log(`[tenant] já existe: ${existente.id} — "${existente.name}". Idempotente, nada feito.`)
  process.exit(0)
}

const { data: criado, error } = await db
  .from("tenants")
  .insert({
    slug: SLUG_DESCARTAVEL,
    name: "GAUNTLET — tenant descartável (não é cliente)",
    // `plan` e `status` têm CHECK constraint no banco. Medido: os valores em
    // uso são standard|premium e active. "free"/"inactive" REPROVAM — o banco
    // falhou fechado e não criou linha nenhuma, que é o comportamento certo.
    // Usamos o menor plano válido; o isolamento vem da trava, não do plano.
    status: "active",
    plan: "standard",
    whitelabel_enabled: false,
  })
  .select("id,slug,name")
  .single()

if (error) {
  console.error(`[tenant] falha ao criar: ${error.message}`)
  process.exit(1)
}

console.log(`[tenant] criado: ${criado.id} — slug "${criado.slug}".`)
console.log(`[tenant] plan/status seguem o CHECK do banco (standard/active): "free"/"inactive"`)
console.log(`[tenant] reprovam na constraint. O isolamento NÃO vem do status — vem da trava,`)
console.log(`[tenant] que recusa qualquer escrita fora deste id. Ele existe só para o elo 4.`)
