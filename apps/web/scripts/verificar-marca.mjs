#!/usr/bin/env node
// ===========================================================================
// GATE 1 DE 2 — A MARCA DECLARADA (roda ANTES do build).
// O gate 2 é `verificar-marca-no-artefato.mjs`, que roda DEPOIS e mede o que
// o Next realmente inlinou. Este aqui só olha a DECLARAÇÃO; sozinho ele não
// prova nada sobre o produto, e é por isso que existem dois.
//
// POR QUE NÃO É UM `throw` DENTRO DE tenant.config.ts
// -------------------------------------------------------------------------
// `tenant.config.ts` é lido pelo bundle do navegador. Um `throw` lá não é
// gate: o Next pode não avaliar o módulo durante `next build` (todas as rotas
// que o usam são dinâmicas), e se disparasse cairia em tempo de REQUISIÇÃO,
// derrubando produção do cliente. Um `exit != 0` AQUI só pode derrubar o
// build. Maker (a config) separado do checker (este arquivo).
//
// FAIL-CLOSED: A AUSÊNCIA DE INFORMAÇÃO É REPROVAÇÃO, NUNCA "OK"
// -------------------------------------------------------------------------
// A versão anterior deste gate lia `process.env` e, se não achasse nada,
// imprimia `[marca] OK — build de tenant "(neutro)"` com exit 0. Isso é pior
// que gate nenhum: no Next, `NEXT_PUBLIC_*` é inlinado em BUILD-time. Quem
// cadastrar as variáveis na aba de ambiente de RUNTIME do EasyPanel (em vez
// de build-arg) faz o `ARG` do estágio builder chegar vazio — o Next inlina o
// NEUTRO, este gate não vê nada, responde OK, e o build verde entrega marca
// neutra para a produção de um cliente pagante, sem um único erro.
//
// A correção é a Regra 0: `MARCA_ESPERADA_SLUG` é OBRIGATÓRIA em todo build.
// Ela é a única variável que o serviço precisa acertar, e errá-la é ruidoso.
//   - `MARCA_ESPERADA_SLUG=cory-alimentos` → build de cliente: a identidade
//     inteira passa a ser exigida.
//   - `MARCA_ESPERADA_SLUG=neutro`         → build neutro DECLARADO: nenhuma
//     variável de marca pode estar presente.
//   - ausente                              → REPROVA. "Não chegou nada" deixa
//     de ser indistinguível de "é para ser neutro".
//
// O ESTADO QUE ELE IMPEDE
// -----------------------
// O perigoso não é "sem marca" nem "com marca": é a MARCA PELA METADE.
// `NEXT_PUBLIC_TENANT_SLUG` é a chave de tenant real — vai para o `tenantId`
// do PostHog e é usado por `gauntlet-preview/*/leitura-real.ts` para resolver
// o tenant com `createServiceClient()` (service_role, RLS contornada). Slug de
// cliente com nome/logo neutros faz a telemetria atribuir eventos ao tenant
// certo enquanto a TELA mostra a marca errada.
//
// USO
//   MARCA_ESPERADA_SLUG=neutro          node apps/web/scripts/verificar-marca.mjs
//   MARCA_ESPERADA_SLUG=cory-alimentos  node apps/web/scripts/verificar-marca.mjs
// ===========================================================================

import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, "../../..")
const PUBLICO = resolve(RAIZ, "apps/web/public")

/** O valor que declara, explicitamente, um build sem cliente nenhum. */
export const SENTINELA_NEUTRO = "neutro"

/**
 * Os ids de módulo válidos, lidos da FONTE (`registry.ts`), nunca copiados.
 * Copiar a lista aqui criaria uma segunda verdade que envelhece em silêncio:
 * o dia em que alguém adiciona um módulo, este verificador passaria a
 * reprovar um valor legítimo.
 */
export function idsDeModuloValidos() {
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
const PREFIXO = "NEXT_PUBLIC_TENANT_"

/**
 * As variáveis que um build de cliente TEM de declarar, e a consequência
 * exata de deixar cada uma em branco. Toda linha desta tabela existe porque
 * a ausência dela cai num default NEUTRO em silêncio — a tela mostra outra
 * coisa e nada estoura.
 *
 * `PARTNER_NAME`/`PARTNER_LOGO` NÃO estão aqui de propósito: nem todo cliente
 * tem parceiro. Eles são verificados aos pares mais abaixo (um sem o outro é
 * meia-marca). `FAVICON` está aqui mesmo sendo idêntico ao neutro no caso da
 * Cory: o próximo cliente serviria o ícone da eximIA na aba do navegador sem
 * ninguém perceber.
 */
const OBRIGATORIAS = [
  ["NEXT_PUBLIC_TENANT_NAME", 'o nome na tela cairia em "eximIA Academy"'],
  ["NEXT_PUBLIC_TENANT_LOGO", "o logo cairia no neutro /brand/logo.png"],
  [
    "NEXT_PUBLIC_TENANT_LOGO_LIGHT",
    "o logo do tema CLARO (o que quase todo usuario ve) cairia em NEXT_PUBLIC_TENANT_LOGO; no neutro ele e um arquivo DIFERENTE (/brand/logo-color.png), entao os dois caminhos divergem",
  ],
  ["NEXT_PUBLIC_TENANT_FAVICON", "o icone da aba do navegador cairia no da eximIA"],
  ["NEXT_PUBLIC_TENANT_PRIMARY_COLOR", "a cor primaria cairia no azul neutro #2a6ab0"],
  ["NEXT_PUBLIC_TENANT_ACCENT_COLOR", "a cor de destaque cairia no neutro #C4A882"],
  [
    "NEXT_PUBLIC_TENANT_MODULES",
    "a config cairia no conjunto NEUTRO de 6 modulos, que e MAIOR que o de qualquer cliente: o cliente ganharia modulos que nao comprou, em silencio",
  ],
  ["NEXT_PUBLIC_TENANT_FOOTER_TEXT", "o rodape do cliente sumiria da tela"],
  ["NEXT_PUBLIC_TENANT_SUPPORT_EMAIL", "o e-mail de suporte do cliente sumiria da tela"],
]

/** Caminhos de asset: precisam ser absolutos sob /public E existir em disco. */
const ASSETS = [
  "NEXT_PUBLIC_TENANT_LOGO",
  "NEXT_PUBLIC_TENANT_LOGO_LIGHT",
  "NEXT_PUBLIC_TENANT_FAVICON",
  "NEXT_PUBLIC_TENANT_PARTNER_LOGO",
]

export function verificar(env, idsValidos, { publico = PUBLICO } = {}) {
  const erros = []
  const avisos = []

  const declarado = texto(env.MARCA_ESPERADA_SLUG)
  const slug = texto(env.NEXT_PUBLIC_TENANT_SLUG)
  const definidas = Object.keys(env)
    .filter((k) => k.startsWith(PREFIXO) && texto(env[k]))
    .sort()

  // --- Regra 0: nenhuma declaracao = REPROVA (o coracao do fail-closed) ----
  if (!declarado) {
    erros.push(
      "MARCA_ESPERADA_SLUG nao chegou ao estagio de build. Sem ela este gate nao " +
        `consegue distinguir "build neutro de proposito" de "build de cliente que perdeu as variaveis". ` +
        `Declare MARCA_ESPERADA_SLUG=${SENTINELA_NEUTRO} para um build sem cliente, ou ` +
        "MARCA_ESPERADA_SLUG=<slug-do-cliente> para um build de cliente. " +
        `No Docker ela precisa ser passada como --build-arg: variavel so no ambiente de RUNTIME nao alcanca o builder, e NEXT_PUBLIC_* e inlinado em build-time. ` +
        `Diagnostico: ${definidas.length} variavel(is) ${PREFIXO}* visivel(is) aqui${definidas.length ? ` (${definidas.join(", ")})` : ""}.`,
    )
  }

  const buildNeutro = declarado === SENTINELA_NEUTRO

  // --- Regra 1: neutro declarado nao pode carregar marca de cliente --------
  if (buildNeutro) {
    for (const chave of definidas) {
      erros.push(
        `MARCA_ESPERADA_SLUG=${SENTINELA_NEUTRO} declara um build SEM cliente, mas ${chave} esta definida. ` +
          "Ou remova a variavel, ou declare o slug do cliente.",
      )
    }
  }

  // --- Regra 2: build de cliente exige a identidade INTEIRA ---------------
  if (declarado && !buildNeutro) {
    if (!slug) {
      erros.push(
        `MARCA_ESPERADA_SLUG="${declarado}" declara um build do cliente, mas NEXT_PUBLIC_TENANT_SLUG nao chegou. ` +
          "O sintoma classico disto e a variavel cadastrada como ambiente de RUNTIME em vez de --build-arg: " +
          "o ARG do estagio builder fica vazio e o Next inlina o NEUTRO.",
      )
    } else if (slug !== declarado) {
      erros.push(
        `MARCA_ESPERADA_SLUG="${declarado}" mas NEXT_PUBLIC_TENANT_SLUG="${slug}". O build sairia com a identidade de outro tenant.`,
      )
    }

    for (const [chave, consequencia] of OBRIGATORIAS) {
      if (!texto(env[chave])) {
        erros.push(`${chave} ausente num build de cliente: ${consequencia}.`)
      }
    }
  }

  // --- Regra 3: variavel de marca sem slug = marca pela metade ------------
  if (!slug) {
    for (const chave of definidas) {
      erros.push(
        `${chave} esta definida mas NEXT_PUBLIC_TENANT_SLUG nao. Marca pela metade: a tela mostra o cliente e a telemetria atribui ao tenant "demo".`,
      )
    }
  }

  // --- Regra 4: asset absoluto sob /public E existente em disco -----------
  for (const chave of ASSETS) {
    const valor = texto(env[chave])
    if (!valor) continue
    if (!valor.startsWith("/")) {
      erros.push(`${chave}="${valor}" precisa comecar com "/" (caminho sob apps/web/public).`)
      continue
    }
    if (!existsSync(resolve(publico, `.${valor}`))) {
      erros.push(
        `${chave}="${valor}" nao existe em apps/web/public. O navegador serviria 404 no lugar da imagem, sem quebrar o build.`,
      )
    }
  }

  // --- Regra 5: cor invalida e DESCARTADA em silencio pela config ---------
  for (const chave of ["NEXT_PUBLIC_TENANT_PRIMARY_COLOR", "NEXT_PUBLIC_TENANT_ACCENT_COLOR"]) {
    const v = texto(env[chave])
    if (v && !HEX.test(v)) {
      erros.push(
        `${chave}="${v}" nao e hex de 6 digitos (#RRGGBB). A config descartaria em silencio.`,
      )
    }
  }

  // --- Regra 6: token de modulo desconhecido some sem erro ----------------
  const csv = texto(env.NEXT_PUBLIC_TENANT_MODULES)
  if (csv) {
    const lidos = csv
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    if (lidos.length === 0) {
      erros.push(
        `NEXT_PUBLIC_TENANT_MODULES="${csv}" nao tem nenhum token, so separadores. A config cairia no conjunto NEUTRO de modulos, que e MAIOR que o do cliente.`,
      )
    }
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

  // --- Regra 7: par de parceiro (um sem o outro e meia-marca) -------------
  const parceiroNome = texto(env.NEXT_PUBLIC_TENANT_PARTNER_NAME)
  const parceiroLogo = texto(env.NEXT_PUBLIC_TENANT_PARTNER_LOGO)
  if (Boolean(parceiroNome) !== Boolean(parceiroLogo)) {
    erros.push(
      `NEXT_PUBLIC_TENANT_PARTNER_NAME e NEXT_PUBLIC_TENANT_PARTNER_LOGO andam juntos: um so foi definido (${parceiroNome ? "NAME" : "LOGO"}). A config emite o campo presente e omite o outro, produzindo um bloco de parceiro pela metade.`,
    )
  }

  // --- Regra 8: numero invalido cai no padrao em silencio -----------------
  // `inteiro()` usa parseInt: "10x" vira 10, "0" e "abc" caem no padrao. Todos
  // sem um unico erro.
  for (const [chave, padrao] of [
    ["NEXT_PUBLIC_TENANT_MAX_INTERACTIONS", 10],
    ["NEXT_PUBLIC_TENANT_SESSION_TIMEOUT_HOURS", 24],
  ]) {
    const v = texto(env[chave])
    if (v && !/^[1-9][0-9]*$/.test(v)) {
      erros.push(
        `${chave}="${v}" nao e inteiro positivo. A config cairia no padrao ${padrao} em silencio.`,
      )
    }
  }

  // --- Regra 9: booleano invalido vira `false` em silencio ----------------
  const orgTree = texto(env.NEXT_PUBLIC_TENANT_ORG_TREE)
  if (orgTree && !["0", "1", "true", "false"].includes(orgTree.toLowerCase())) {
    erros.push(
      `NEXT_PUBLIC_TENANT_ORG_TREE="${orgTree}" nao e 0/1/true/false. A config trata como DESLIGADO em silencio: quem escreveu "sim" acha que ligou a arvore organizacional e ela nao esta la.`,
    )
  }

  return {
    erros,
    avisos,
    slug: slug ?? (buildNeutro ? `(${SENTINELA_NEUTRO})` : "(ausente)"),
    declarado: declarado ?? "(indeclarado)",
    buildNeutro,
  }
}

// --- CLI -------------------------------------------------------------------
const ehCLI =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (ehCLI) {
  const { erros, avisos, slug, buildNeutro } = verificar(process.env, idsDeModuloValidos())
  for (const a of avisos) console.warn(`[marca] AVISO: ${a}`)
  if (erros.length > 0) {
    console.error(`[marca] REPROVADO (${erros.length} erro(s)):`)
    for (const e of erros) console.error(`  - ${e}`)
    process.exit(1)
  }
  console.log(
    buildNeutro
      ? "[marca] OK — build NEUTRO declarado (nenhuma variavel de marca de cliente presente)."
      : `[marca] OK — build declarado do tenant "${slug}".`,
  )
}
