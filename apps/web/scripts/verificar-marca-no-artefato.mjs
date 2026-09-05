#!/usr/bin/env node
// ===========================================================================
// GATE 2 DE 2 — A MARCA NO ARTEFATO (roda DEPOIS do build).
//
// O gate 1 (`verificar-marca.mjs`) mede a DECLARAÇÃO, e diz isso de si mesmo:
// "sozinho ele não prova nada sobre o produto, e é por isso que existem dois".
// Este é o segundo. Ele não olha uma única variável para decidir se o produto
// está certo: ele abre os bundles que o `next build` produziu e procura os
// bytes da identidade lá dentro.
//
// O ESTADO QUE SÓ ESTE GATE PEGA
// -------------------------------------------------------------------------
// As variáveis chegam ao estágio `builder`, o gate 1 aprova, e o bundle sai
// NEUTRO assim mesmo — porque o `next build` roda dentro do `turbo` e o
// `turbo.json` filtra o ambiente (`"env": ["NEXT_PUBLIC_TENANT_*"]`), ou
// porque um `.env.production` entrou no `apps/web` depois, ou porque a regra
// de inline do Next mudou. Build verde, marca da eximIA entregue ao cliente
// pagante, e ninguém tem como saber sem abrir o artefato. Abrir o artefato é
// exatamente o que este arquivo faz.
//
// FAIL-CLOSED: A AUSÊNCIA DE INFORMAÇÃO É REPROVAÇÃO, NUNCA "OK"
// -------------------------------------------------------------------------
// Mesma Regra 0 do gate 1, pelo mesmo motivo. Sem `MARCA_ESPERADA_SLUG` não há
// como distinguir "neutro de propósito" de "cliente que perdeu as variáveis" —
// reprova. Diretório de artefato ausente, ou presente e sem um único `.js`,
// também reprova: "não achei o que medir" é o resultado mais perigoso que
// existe para um gate, porque some sem barulho.
//
// O QUE ELE NÃO PROVA (dito aqui para o próximo leitor não presumir cobertura,
// que é o defeito que o gate 1 cometeu ao anunciar este arquivo antes dele
// existir)
// -------------------------------------------------------------------------
// Ele prova PRESENÇA dos bytes certos, não AUSÊNCIA dos errados. Um bundle de
// cliente pode carregar os literais neutros como sobra do `??` não dobrado
// pelo minificador — isso não é sintoma de nada, e afirmar que fosse produziria
// reprovação falsa. A ausência do valor do cliente, essa sim, é sintoma direto
// e é o que este gate reprova.
//
// USO
//   node apps/web/scripts/verificar-marca-no-artefato.mjs
//   node apps/web/scripts/verificar-marca-no-artefato.mjs <dir-do-artefato>
// ===========================================================================

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, "../../..")
const ARTEFATO_PADRAO = resolve(RAIZ, "apps/web/.next")

export const SENTINELA_NEUTRO = "neutro"

const texto = (v) => {
  const t = (v ?? "").trim()
  return t === "" ? undefined : t
}

/**
 * A identidade que precisa ter sobrevivido ao build, e o nome da variável que
 * a produz. É deliberadamente a marca VISÍVEL (`config.brand`): são os campos
 * cuja troca silenciosa entrega a tela de outro dono. Rodapé, e-mail de
 * suporte e módulos ficam de fora porque o gate 1 já exige a declaração deles
 * e eles não têm presença garantida no bundle do NAVEGADOR — exigi-los aqui
 * criaria reprovação falsa, que mata um gate mais rápido que falso-OK.
 */
const IDENTIDADE_VISIVEL = [
  ["NEXT_PUBLIC_TENANT_SLUG", "slug"],
  ["NEXT_PUBLIC_TENANT_NAME", "name"],
  ["NEXT_PUBLIC_TENANT_LOGO", "logo"],
  ["NEXT_PUBLIC_TENANT_LOGO_LIGHT", "logoLight"],
  ["NEXT_PUBLIC_TENANT_FAVICON", "favicon"],
  ["NEXT_PUBLIC_TENANT_PRIMARY_COLOR", "primaryColor"],
  ["NEXT_PUBLIC_TENANT_ACCENT_COLOR", "accentColor"],
]

/**
 * O NEUTRO lido da FONTE (`tenant.config.ts`), nunca copiado — mesma doutrina
 * de `idsDeModuloValidos()` no gate 1. Uma segunda cópia destes valores
 * envelheceria em silêncio, e o dia em que alguém trocasse o logo neutro este
 * gate passaria a reprovar builds neutros legítimos.
 */
export function neutroDaFonte() {
  const fonte = resolve(RAIZ, "apps/web/tenant.config.ts")
  const src = readFileSync(fonte, "utf8")
  const bloco = src.match(/const NEUTRO = \{([\s\S]*?)\n\} as const/)
  if (!bloco) {
    throw new Error(
      `Nao consegui ler o bloco NEUTRO de ${fonte}. O formato da declaracao mudou; conserte este verificador em vez de remove-lo.`,
    )
  }
  const valores = {}
  for (const [, chave, valor] of bloco[1].matchAll(/(\w+):\s*"([^"]+)"/g)) valores[chave] = valor
  const exigidos = ["name", "slug", "logo", "logoLight", "favicon", "primaryColor", "accentColor"]
  const faltando = exigidos.filter((k) => !valores[k])
  if (faltando.length > 0) {
    throw new Error(`Bloco NEUTRO de ${fonte} nao trouxe: ${faltando.join(", ")}.`)
  }
  return valores
}

/** Todos os `.js` do artefato — é onde o Next deposita o que inlinou. */
export function arquivosDoArtefato(dir) {
  const achados = []
  const visitar = (atual) => {
    for (const entrada of readdirSync(atual)) {
      const caminho = join(atual, entrada)
      if (statSync(caminho).isDirectory()) visitar(caminho)
      else if (caminho.endsWith(".js")) achados.push(caminho)
    }
  }
  visitar(dir)
  return achados
}

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * `valor` aparece literalmente em algum arquivo? Hex é comparado sem
 * diferenciar caixa: o minificador reescreve `#C4A882` como `#c4a882` sem
 * mudar cor nenhuma, e reprovar por isso seria medir o minificador.
 */
function apareceEm(conteudos, valor) {
  if (HEX.test(valor)) {
    const alvo = valor.toLowerCase()
    return conteudos.some((c) => c.toLowerCase().includes(alvo))
  }
  return conteudos.some((c) => c.includes(valor))
}

export function verificar(env, conteudos, { neutro }) {
  const erros = []
  const declarado = texto(env.MARCA_ESPERADA_SLUG)

  // --- Regra 0: nenhuma declaracao = REPROVA -------------------------------
  if (!declarado) {
    erros.push(
      "MARCA_ESPERADA_SLUG nao chegou ao estagio que mede o artefato. Sem ela este gate nao " +
        'consegue distinguir "build neutro de proposito" de "build de cliente que perdeu as variaveis". ' +
        `Declare MARCA_ESPERADA_SLUG=${SENTINELA_NEUTRO} ou MARCA_ESPERADA_SLUG=<slug-do-cliente>.`,
    )
    return { erros, declarado: "(indeclarado)" }
  }

  const buildNeutro = declarado === SENTINELA_NEUTRO

  // --- Regra 1: neutro declarado tem de ter saido NEUTRO -------------------
  if (buildNeutro) {
    for (const [, campo] of IDENTIDADE_VISIVEL) {
      const valor = neutro[campo]
      if (!apareceEm(conteudos, valor)) {
        erros.push(
          `MARCA_ESPERADA_SLUG=${SENTINELA_NEUTRO} declara um build sem cliente, mas o valor neutro de ` +
            `\`${campo}\` ("${valor}") nao esta no artefato. O bundle saiu com OUTRA identidade: um build ` +
            "neutro que entrega marca de cliente e o mesmo defeito do inverso, na outra direcao.",
        )
      }
    }
    return { erros, declarado, buildNeutro }
  }

  // --- Regra 2: build de cliente exige a identidade INLINADA ---------------
  const slug = texto(env.NEXT_PUBLIC_TENANT_SLUG)
  if (slug && slug !== declarado) {
    erros.push(
      `MARCA_ESPERADA_SLUG="${declarado}" mas NEXT_PUBLIC_TENANT_SLUG="${slug}" no ambiente que mede o artefato.`,
    )
  }

  for (const [chave, campo] of IDENTIDADE_VISIVEL) {
    const valor = texto(env[chave])
    if (!valor) {
      erros.push(
        `${chave} nao esta no ambiente que mede o artefato, entao nao ha o que procurar no bundle. ` +
          "Ausencia de informacao reprova: passe a variavel tambem a este estagio.",
      )
      continue
    }
    if (apareceEm(conteudos, valor)) continue
    erros.push(
      `${chave}="${valor}" NAO aparece em nenhum bundle do artefato. O gate 1 aprovou a declaracao, ` +
        `mas o \`next build\` nao inlinou o valor: o produto entregue mostra a marca NEUTRA no campo ` +
        `\`${campo}\` para o cliente "${declarado}". Causa tipica: a variavel nao alcancou o \`next build\` ` +
        "(filtro de ambiente do turbo, `.env.production` no apps/web, ou variavel so de runtime).",
    )
  }

  return { erros, declarado, buildNeutro }
}

// --- CLI -------------------------------------------------------------------
const ehCLI =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (ehCLI) {
  const dir = resolve(process.argv[2] ?? ARTEFATO_PADRAO)

  if (!existsSync(dir)) {
    console.error(
      `[marca:artefato] REPROVADO: o artefato ${dir} nao existe. Este gate roda DEPOIS do build; ` +
        'sem artefato nao ha o que medir, e "nada a verificar" nunca vira OK.',
    )
    process.exit(1)
  }

  const arquivos = arquivosDoArtefato(dir)
  if (arquivos.length === 0) {
    console.error(
      `[marca:artefato] REPROVADO: nenhum arquivo .js em ${dir}. O build nao produziu bundle, ` +
        "ou o caminho do artefato mudou. Reprova em vez de aprovar o vazio.",
    )
    process.exit(1)
  }

  const conteudos = arquivos.map((a) => readFileSync(a, "utf8"))
  const { erros, declarado, buildNeutro } = verificar(process.env, conteudos, {
    neutro: neutroDaFonte(),
  })

  if (erros.length > 0) {
    console.error(`[marca:artefato] REPROVADO (${erros.length} erro(s)):`)
    for (const e of erros) console.error(`  - ${e}`)
    process.exit(1)
  }

  console.log(
    buildNeutro
      ? `[marca:artefato] OK — o artefato (${arquivos.length} bundles) carrega a identidade NEUTRA declarada.`
      : `[marca:artefato] OK — o artefato (${arquivos.length} bundles) carrega a identidade inteira do tenant "${declarado}".`,
  )
}
