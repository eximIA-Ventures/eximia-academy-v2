/**
 * backfill-cory-report-name.ts
 *
 * Backfill de users.report_name para o tenant Cory Alimentos, derivado do
 * local-part do e-mail de cadastro (nome.sobrenome), com gates que retornam
 * NULL + motivo em vez de adivinhar quando o padrão não é confiável.
 *
 * Escopo: SOMENTE tenant Cory (belt-and-suspenders no select E no update).
 * Idempotente: só processa report_name IS NULL. Respeita deleted_at IS NULL.
 *
 * DRY_RUN=true por padrão (não escreve nada). Só aplica com DRY_RUN=0.
 *
 * Uso:
 *   pnpm tsx scripts/backfill-cory-report-name.ts            # dry-run (default)
 *   DRY_RUN=0 pnpm tsx scripts/backfill-cory-report-name.ts  # aplica de verdade
 *
 * Conexão: lê apps/web/.env.local (mesmo padrão de scripts/copy-slides.mjs),
 * usando NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

// ── Config ──────────────────────────────────────────────────────────────────
const CORY_TENANT = "a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32"
const DRY_RUN = process.env.DRY_RUN !== "0"

// Mapa de override manual (email → report_name). EXATAMENTE 11, aprovados
// linha a linha pelo Hugo. Cobrem os casos que o algoritmo não deriva com
// segurança (caixas funcionais, no-dot, sufixo-como-sobrenome, gmail/hotmail).
const OVERRIDE: Record<string, string> = {
  "segurancadotrabalhorp@cory.com.br": "Alexander Nunes",
  "engenhariadeprocessos@cory.com.br": "Isabela Catozzo",
  "manutencaoarc@cory.com.br": "Paulo Cesar",
  "vamaral@cory.com.br": "Venilton Amaral",
  "fabianamartinss433@gmail.com": "Fabiana Martins",
  "sambelmont91@gmail.com": "Samuel Belmont",
  "viniciuscesar0816@gmail.com": "Vinicius Cesar",
  "paulos.yida@gmail.com": "Paulo Yida",
  "edwilliam2008@hotmail.com": "Ed William",
  "oderso.junior@cory.com.br": "Oderso Junior",
  "valdeci.junior@cory.com.br": "Valdeci Junior",
}

// Skip explícito: deixar report_name = NULL, não derivar nada.
// Conta de teste inativa marcada para remoção.
const SKIP = new Set<string>(["gestor.teste@cory.com.br"])

// Partículas que permanecem em minúsculas quando NÃO são o primeiro segmento.
const PARTICLES = new Set<string>([
  "da",
  "de",
  "do",
  "das",
  "dos",
  "e",
  "di",
  "del",
  "la",
  "van",
  "von",
])

// Sufixos de geração que, sozinhos como 2º segmento, tornam o nome ambíguo.
const GEN_SUFFIXES = new Set<string>([
  "junior",
  "jr",
  "filho",
  "neto",
  "sobrinho",
  "segundo",
])

// ── Derivação ────────────────────────────────────────────────────────────────
type DeriveResult =
  | { value: string; source: "algorithm" }
  | { value: null; reason: string }

function titleCaseSegment(seg: string, isFirst: boolean): string {
  // Hífen dentro de um segmento: Title Case de cada lado.
  if (seg.includes("-")) {
    return seg
      .split("-")
      .map((part) => titleCaseSegment(part, isFirst))
      .join("-")
  }
  if (!isFirst && PARTICLES.has(seg)) return seg
  if (seg.length === 0) return seg
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

function derive(emailRaw: string): DeriveResult {
  const email = emailRaw.toLowerCase().trim()
  const atIdx = email.indexOf("@")
  const localPart = atIdx >= 0 ? email.slice(0, atIdx) : email

  // GATE FUNCTIONAL_MAILBOX: sem "." E length > 10 → caixa de setor.
  if (!localPart.includes(".") && localPart.length > 10) {
    return { value: null, reason: "FUNCTIONAL_MAILBOX" }
  }

  // Split por "."
  const rawSegments = localPart.split(".")

  // GATE NO_DOT_AMBIGUOUS: 1 segmento só após o split.
  if (rawSegments.length === 1) {
    return { value: null, reason: "NO_DOT_AMBIGUOUS" }
  }

  // Limpar cada segmento: remover sufixo numérico, descartar vazios.
  const segments = rawSegments
    .map((s) => s.replace(/\d+$/, ""))
    .filter((s) => s.length > 0)

  // GATE SUFFIX_ONLY_SURNAME: exatamente 2 segmentos e o 2º é sufixo de geração.
  if (segments.length === 2 && GEN_SUFFIXES.has(segments[1])) {
    return { value: null, reason: "SUFFIX_ONLY_SURNAME" }
  }

  if (segments.length === 0) {
    return { value: null, reason: "NO_DOT_AMBIGUOUS" }
  }

  const value = segments
    .map((seg, i) => titleCaseSegment(seg, i === 0))
    .join(" ")

  return { value, source: "algorithm" }
}

// ── Resolução por linha ──────────────────────────────────────────────────────
type Resolution = {
  email: string
  fullName: string | null
  reportName: string | null
  kind: "override" | "skip" | "derived" | "flagged"
  reason?: string
}

function resolve_row(email: string, fullName: string | null): Resolution {
  const key = email.toLowerCase().trim()

  if (key in OVERRIDE) {
    return { email, fullName, reportName: OVERRIDE[key], kind: "override" }
  }
  if (SKIP.has(key)) {
    return {
      email,
      fullName,
      reportName: null,
      kind: "skip",
      reason: "SKIP_LIST",
    }
  }
  const d = derive(email)
  if (d.value === null) {
    return {
      email,
      fullName,
      reportName: null,
      kind: "flagged",
      reason: d.reason,
    }
  }
  return { email, fullName, reportName: d.value, kind: "derived" }
}

// ── Env loading (padrão de scripts/copy-slides.mjs) ──────────────────────────
function loadEnv(): { url: string; key: string } {
  const here = dirname(fileURLToPath(import.meta.url))
  const envPath = resolve(here, "../apps/web/.env.local")
  const envFile = readFileSync(envPath, "utf-8")
  const env: Record<string, string> = {}
  for (const line of envFile.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em apps/web/.env.local",
    )
  }
  return { url, key }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { url, key } = loadEnv()
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log("=".repeat(78))
  console.log("BACKFILL users.report_name — tenant Cory Alimentos")
  console.log(`Projeto: ${url}`)
  console.log(`Tenant:  ${CORY_TENANT}`)
  console.log(`Modo:    ${DRY_RUN ? "DRY-RUN (nenhuma escrita)" : "APLICANDO (DRY_RUN=0)"}`)
  console.log("=".repeat(78))

  // Query idempotente: só quem ainda não tem report_name.
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, report_name")
    .eq("tenant_id", CORY_TENANT)
    .is("deleted_at", null)
    .is("report_name", null)
    .order("email", { ascending: true })

  if (error) {
    console.error("\nERRO ao consultar users:", error.message)
    console.error("(Se for 'column users.report_name does not exist', a migration ainda não foi aplicada.)")
    process.exit(1)
  }

  const rows = (data ?? []) as Array<{
    id: string
    email: string
    full_name: string | null
    report_name: string | null
  }>

  const resolutions = rows.map((r) =>
    resolve_row(r.email, r.full_name),
  ) as Array<Resolution & { id?: string }>
  resolutions.forEach((res, i) => (res.id = rows[i].id))

  // ── Relatório ──────────────────────────────────────────────────────────────
  const derived = resolutions.filter((r) => r.kind === "derived")
  const override = resolutions.filter((r) => r.kind === "override")
  const skipped = resolutions.filter((r) => r.kind === "skip")
  const flagged = resolutions.filter((r) => r.kind === "flagged")

  console.log(`\nLinhas elegíveis (report_name IS NULL): ${rows.length}`)
  console.log(
    `  Derivadas pelo algoritmo: ${derived.length}` +
      ` | Override manual: ${override.length}` +
      ` | NULL (flag): ${flagged.length}` +
      ` | NULL (skip): ${skipped.length}`,
  )

  console.log("\n" + "-".repeat(78))
  console.log("TABELA COMPLETA (email → report_name | origem | full_name atual)")
  console.log("-".repeat(78))
  for (const r of resolutions) {
    const rn = r.reportName === null ? "NULL" : r.reportName
    const tag =
      r.kind === "override"
        ? "override"
        : r.kind === "skip"
          ? `skip:${r.reason}`
          : r.kind === "flagged"
            ? `flag:${r.reason}`
            : "algo"
    console.log(
      `${r.email.padEnd(38)} → ${rn.padEnd(22)} [${tag}]  (full_name: ${r.fullName ?? "∅"})`,
    )
  }

  if (flagged.length > 0) {
    console.log("\n" + "-".repeat(78))
    console.log("FICARAM NULL (flag) — deixados para revisão humana:")
    console.log("-".repeat(78))
    for (const r of flagged) {
      console.log(`  ${r.email.padEnd(38)} — ${r.reason}`)
    }
  }
  if (skipped.length > 0) {
    console.log("\nFICARAM NULL (skip list explícita):")
    for (const r of skipped) console.log(`  ${r.email} — ${r.reason}`)
  }

  // ── Aplicação ────────────────────────────────────────────────────────────
  const toWrite = resolutions.filter((r) => r.reportName !== null)

  if (DRY_RUN) {
    console.log("\n" + "=".repeat(78))
    console.log(
      `DRY-RUN: NADA foi escrito. ${toWrite.length} linhas seriam atualizadas` +
        ` (derivadas + override), ${flagged.length + skipped.length} permaneceriam NULL.`,
    )
    console.log("Para aplicar de verdade: DRY_RUN=0 pnpm tsx scripts/backfill-cory-report-name.ts")
    console.log("=".repeat(78))
    return
  }

  console.log("\n" + "=".repeat(78))
  console.log(`APLICANDO ${toWrite.length} updates (linha a linha, escopo Cory)...`)
  console.log("=".repeat(78))

  let ok = 0
  let fail = 0
  for (const r of toWrite) {
    const { error: upErr } = await supabase
      .from("users")
      .update({ report_name: r.reportName })
      .eq("id", r.id as string)
      .eq("tenant_id", CORY_TENANT) // belt-and-suspenders no update
    if (upErr) {
      fail++
      console.error(`  ✗ ${r.email}: ${upErr.message}`)
    } else {
      ok++
      console.log(`  ✓ ${r.email} → ${r.reportName}`)
    }
  }

  console.log("\n" + "=".repeat(78))
  console.log(`APLICADO: ${ok} ok, ${fail} falhas. NULL (flag+skip): ${flagged.length + skipped.length}.`)
  console.log("=".repeat(78))
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
