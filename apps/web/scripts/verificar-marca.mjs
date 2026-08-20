#!/usr/bin/env node
// ===========================================================================
// VERIFICADOR DA MARCA POR ENV — roda ANTES do build, nunca dentro dele.
//
// POR QUE ELE EXISTE, E POR QUE NÃO É UM `throw` DENTRO DE tenant.config.ts
// -------------------------------------------------------------------------
// `tenant.config.ts` é lido pelo bundle do navegador. Um `throw` lá não é
// gate: o Next pode não avaliar o módulo durante `next build` (todas as rotas
// que o usam são dinâmicas), e se disparasse cairia em tempo de REQUISIÇÃO,
// derrubando produção do cliente. Um `exit != 0` AQUI só pode derrubar o
// build. Maker (a config) separado do checker (este arquivo).
//
// O ESTADO QUE ELE IMPEDE
// -----------------------
// O perigoso não é "sem marca" nem "com marca": é a MARCA PELA METADE.
// `NEXT_PUBLIC_TENANT_SLUG` é a chave de tenant real — vai para o `tenantId`
// do PostHog e é usado por `gauntlet-preview/*/leitura-real.ts` para resolver
// o tenant com `createServiceClient()` (service_role, RLS contornada). Slug de
// cliente com nome/logo neutros faz a telemetria atribuir eventos ao tenant
// certo enquanto a TELA mostra a marca errada. Por isso: presença do slug
// obriga a identidade inteira.
//
// USO
//   node apps/web/scripts/verificar-marca.mjs
//   MARCA_ESPERADA_SLUG=cory-alimentos node apps/web/scripts/verificar-marca.mjs
// ===========================================================================

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, "../../..")

/**
 * Os ids de módulo válidos, lidos da FONTE (`registry.ts`), nunca copiados.
 * Copiar a lista aqui criaria uma segunda verdade que envelhece em silêncio:
 * o dia em que alguém adiciona um módulo, este verificador passaria a
 * reprovar um valor legítimo.
 */
function idsDeModuloValidos() {
  const fonte = resolve(RAIZ, "packages/shared/src/modules/registry.ts")
  const src = readFileSync(fonte, "utf8")
  const bloco = src.match(/export const MODULE_IDS = \[([\s\S]*?)\] as const/)
  if (!bloco) {
    throw new Error(
      `Nao consegui ler MODULE_IDS de ${fonte}. O formato da declaracao mudou; conserte este verificador em vez de remove-lo.`,
    )
  }
  const ids = [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  if (ids.length === 0) throw new Error(`MODULE_IDS lido de ${fonte} veio vazio.`)
  return ids
}

const texto = (v) => {
  const t = (v ?? "").trim()
  return t === "" ? undefined : t
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function verificar(env, idsValidos) {
  const erros = []
  const avisos = []

  const slug = texto(env.NEXT_PUBLIC_TENANT_SLUG)
  const nome = texto(env.NEXT_PUBLIC_TENANT_NAME)
  const logo = texto(env.NEXT_PUBLIC_TENANT_LOGO)
  const logoClaro = texto(env.NEXT_PUBLIC_TENANT_LOGO_LIGHT)

  // --- Regra 1: o slug é a chave. Presente, exige a identidade inteira. ----
  if (slug) {
    if (!nome) {
      erros.push(
        "NEXT_PUBLIC_TENANT_SLUG esta definido mas NEXT_PUBLIC_TENANT_NAME nao. " +
          "Isso produz um build com o tenant do cliente e o NOME neutro: a telemetria " +
          "atribui ao cliente e a tela mostra 'eximIA Academy'.",
      )
    }
    if (!logo) {
      erros.push(
        "NEXT_PUBLIC_TENANT_SLUG esta definido mas NEXT_PUBLIC_TENANT_LOGO nao. " +
          "O build sairia com o logo neutro em /brand/logo.png.",
      )
    }
    if (logo && !logoClaro) {
      avisos.push(
        "NEXT_PUBLIC_TENANT_LOGO_LIGHT ausente: o logo do tema CLARO (o que quase " +
          "todo usuario ve) vai cair em NEXT_PUBLIC_TENANT_LOGO. Se o logo do cliente " +
          "nao tem contraste em fundo claro, defina os dois.",
      )
    }
  } else {
    for (const chave of Object.keys(env)) {
      if (chave.startsWith("NEXT_PUBLIC_TENANT_") && texto(env[chave])) {
        erros.push(
          `${chave} esta definido mas NEXT_PUBLIC_TENANT_SLUG nao. Marca pela metade: defina o slug para declarar um build de cliente, ou remova ${chave} para um build neutro.`,
        )
      }
    }
  }

  // --- Regra 2: caminho de asset tem que ser absoluto sob /public ----------
  for (const [chave, valor] of [
    ["NEXT_PUBLIC_TENANT_LOGO", logo],
    ["NEXT_PUBLIC_TENANT_LOGO_LIGHT", logoClaro],
    ["NEXT_PUBLIC_TENANT_FAVICON", texto(env.NEXT_PUBLIC_TENANT_FAVICON)],
    ["NEXT_PUBLIC_TENANT_PARTNER_LOGO", texto(env.NEXT_PUBLIC_TENANT_PARTNER_LOGO)],
  ]) {
    if (valor && !valor.startsWith("/")) {
      erros.push(`${chave}="${valor}" precisa comecar com "/" (caminho sob apps/web/public).`)
    }
  }

  // --- Regra 3: cor invalida é DESCARTADA em silencio pela config ---------
  for (const chave of ["NEXT_PUBLIC_TENANT_PRIMARY_COLOR", "NEXT_PUBLIC_TENANT_ACCENT_COLOR"]) {
    const v = texto(env[chave])
    if (v && !HEX.test(v)) {
      erros.push(
        `${chave}="${v}" nao e hex de 6 digitos (#RRGGBB). A config descartaria em silencio.`,
      )
    }
  }

  // --- Regra 4: token de modulo desconhecido some sem erro ----------------
  const csv = texto(env.NEXT_PUBLIC_TENANT_MODULES)
  if (csv) {
    const lidos = csv
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    const desconhecidos = lidos.filter((t) => !idsValidos.includes(t))
    if (desconhecidos.length > 0) {
      erros.push(
        `NEXT_PUBLIC_TENANT_MODULES tem token(s) desconhecido(s): ${desconhecidos.join(", ")}. getEnabledModules() os descarta EM SILENCIO, entao um typo tira do cliente um modulo que ele comprou sem erro nenhum. Validos: ${idsValidos.join(", ")}.`,
      )
    }
    if (lidos.length > 0 && desconhecidos.length === lidos.length) {
      erros.push(
        "NEXT_PUBLIC_TENANT_MODULES nao tem NENHUM token valido: a config cairia no " +
          "conjunto neutro de modulos, que e MAIOR que o do cliente.",
      )
    }
  }

  // --- Regra 5: ancora opcional (quem chama declara o que espera) ---------
  const esperado = texto(env.MARCA_ESPERADA_SLUG)
  if (esperado && esperado !== slug) {
    erros.push(
      `MARCA_ESPERADA_SLUG="${esperado}" mas NEXT_PUBLIC_TENANT_SLUG="${slug ?? "(ausente)"}".`,
    )
  }

  return { erros, avisos, slug: slug ?? "(neutro)" }
}

// --- CLI -------------------------------------------------------------------
const ehCLI =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (ehCLI) {
  const { erros, avisos, slug } = verificar(process.env, idsDeModuloValidos())
  for (const a of avisos) console.warn(`[marca] AVISO: ${a}`)
  if (erros.length > 0) {
    console.error(`[marca] REPROVADO (${erros.length} erro(s)):`)
    for (const e of erros) console.error(`  - ${e}`)
    process.exit(1)
  }
  console.log(`[marca] OK — build de tenant "${slug}".`)
}
