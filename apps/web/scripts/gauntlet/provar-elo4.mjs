#!/usr/bin/env node
// ===========================================================================
// Prova do elo 4 — lançador fino.
// ===========================================================================
// A lógica real vive em `provar-elo4-nucleo.ts` (por quê, ver o cabeçalho
// daquele arquivo: importar `fonte-supabase.ts` sem alterar seus imports sem
// extensão exige rodar como `.ts` ambíguo sob `tsx`, não como `.mjs`/`.mts`).
// Este arquivo é o contrato externo: `node scripts/gauntlet/provar-elo4.mjs`,
// repassando argv, stdio e exit code sem alteração.
// ===========================================================================

import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(AQUI, "../../../..")
const TSX = resolve(REPO, "node_modules/.bin/tsx")
const NUCLEO = resolve(AQUI, "provar-elo4-nucleo.ts")

const resultado = spawnSync(TSX, [NUCLEO, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: AQUI,
})

if (resultado.error) {
  console.error("[provar-elo4] falha ao invocar tsx:", resultado.error)
  process.exit(1)
}

process.exit(resultado.status ?? 1)
