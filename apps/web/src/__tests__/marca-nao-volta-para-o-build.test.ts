import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { describe, expect, it } from "vitest"

// ===========================================================================
// TESTE DE FONTE: A MARCA NÃO PODE VOLTAR A SER COISA DE BUILD.
//
// POR QUE ISTO É UM TESTE DE CÓDIGO-FONTE, E NÃO DE COMPORTAMENTO. Os três
// regressos abaixo NÃO produzem erro em lugar nenhum — produzem tela errada em
// silêncio, que é a pior forma de defeito para este app:
//
//   1. `getTenantConfig()` sem `await`. A função virou `async`; sem o `await`
//      o valor é uma `Promise`, e `promise.brand` é `undefined`. O `tsc` pega
//      a maioria dos casos, mas não os que passam por `any` (mocks, `import()`
//      dinâmico desestruturado). O logo some, nada é lançado.
//   2. um componente `"use client"` importando `@/lib/tenant` ou
//      `tenant.config`. No navegador `process.env` não existe e `headers()`
//      não existe: o componente cairia no NEUTRO enquanto o resto da página
//      mostra o cliente. Marca partida ao meio, sem um único erro. Foi
//      EXATAMENTE esse import, no `workspace-picker.tsx`, que obrigava a
//      identidade a ser variável de BUILD.
//   3. uma rota que consome marca sem `dynamic = "force-dynamic"` (D17): o
//      `next build` a prerenderiza e o Full Route Cache passa a servir a marca
//      de UMA empresa a TODAS.
//   4. a marca da INSTÂNCIA (`PLATFORM_*`) lida por acesso LITERAL a
//      `process.env`, ou batizada de `NEXT_PUBLIC_PLATFORM_*`. Nos dois casos
//      o Next inlina o valor no artefato em BUILD — e "eximIA Academy" e
//      "Argos Academy", que são a MESMA imagem em serviços diferentes,
//      voltariam a exigir uma imagem cada. É o defeito 2 outra vez, agora uma
//      camada acima: não é o cliente que fica cravado no build, é a
//      instalação inteira.
//
// É o mesmo espírito do antigo `marca-por-env.test.ts` (que lia o fonte para
// provar o acesso literal a `process.env`), com a pergunta invertida.
// ===========================================================================

const RAIZ_SRC = resolve(__dirname, "..")

/** `tenant.config.ts` vive na RAIZ de `apps/web`, fora do varredor de `src/`. */
const TENANT_CONFIG = resolve(RAIZ_SRC, "..", "tenant.config.ts")

function arquivosDeCodigo(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) {
      if (nome === "node_modules" || nome === ".next") continue
      arquivosDeCodigo(caminho, acc)
    } else if (/\.tsx?$/.test(nome)) {
      acc.push(caminho)
    }
  }
  return acc
}

const ARQUIVOS = arquivosDeCodigo(RAIZ_SRC).map((caminho) => {
  const fonte = readFileSync(caminho, "utf8")
  return {
    rel: relative(RAIZ_SRC, caminho).replace(/\\/g, "/"),
    fonte,
    codigo: semComentarios(fonte),
  }
})

/**
 * O fonte SEM comentários.
 *
 * Sem isto o teste acusaria a si mesmo e a meia dúzia de cabeçalhos que
 * EXPLICAM o defeito — inclusive este arquivo. Um teste que reprova a própria
 * documentação é ruído, e ruído é o que faz um gate ser desligado.
 */
function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_t, antes: string) => antes)
}

/** "É componente de cliente" = tem a diretiva no topo, antes de qualquer import. */
function ehClientComponent(fonte: string): boolean {
  return /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(fonte)
}

/** Chamadas de `nome()` cuja palavra imediatamente anterior NÃO é `await`. */
function chamadasSemAwait(fonte: string, nome: string): number[] {
  const re = new RegExp(`${nome}\\(\\)`, "g")
  const posicoes: number[] = []
  let m = re.exec(fonte)
  while (m) {
    const antes = fonte.slice(0, m.index).trimEnd()
    if (!antes.endsWith("await")) posicoes.push(m.index)
    m = re.exec(fonte)
  }
  return posicoes
}

function linhaDe(fonte: string, indice: number): number {
  return fonte.slice(0, indice).split("\n").length
}

describe("o teste de fonte encontra os arquivos certos (senão ele passa por vazio)", () => {
  it("varre mais de 500 arquivos de `src/`", () => {
    expect(ARQUIVOS.length).toBeGreaterThan(500)
  })

  it("enxerga o picker e os shells que consomem marca", () => {
    const rels = ARQUIVOS.map((a) => a.rel)
    expect(rels).toContain("app/workspace/_components/workspace-picker.tsx")
    expect(rels).toContain("app/(platform)/layout.tsx")
    expect(rels).toContain("lib/tenant.ts")
  })

  it("o detector de `use client` reconhece um arquivo que tem a diretiva", () => {
    const picker = ARQUIVOS.find((a) => a.rel.endsWith("workspace-picker.tsx"))
    expect(picker && ehClientComponent(picker.fonte)).toBe(true)
  })

  it("o detector de chamada sem await acha o caso que deveria achar (controle positivo)", () => {
    expect(chamadasSemAwait("const c = getTenantConfig()", "getTenantConfig")).toHaveLength(1)
    expect(chamadasSemAwait("const c = await getTenantConfig()", "getTenantConfig")).toHaveLength(0)
  })
})

describe("`getTenantConfig()` e `getTenantContext()` são sempre aguardados", () => {
  it("nenhuma chamada sem `await` em `src/`", () => {
    const faltas: string[] = []
    for (const { rel, codigo } of ARQUIVOS) {
      // O próprio scanner cita os dois nomes em strings (título do bloco,
      // controle positivo). Um detector que se autoacusa não distingue nada.
      if (rel === "__tests__/marca-nao-volta-para-o-build.test.ts") continue
      for (const nome of ["getTenantConfig", "getTenantContext"]) {
        for (const i of chamadasSemAwait(codigo, nome)) {
          faltas.push(`${rel}:${linhaDe(codigo, i)} — ${nome}() sem await`)
        }
      }
    }
    expect(faltas).toEqual([])
  })
})

describe("nenhum componente de CLIENTE lê a marca do build", () => {
  it("`workspace-picker.tsx` não importa `@/lib/tenant` nem `tenant.config`", () => {
    const picker = ARQUIVOS.find((a) => a.rel === "app/workspace/_components/workspace-picker.tsx")
    expect(picker).toBeDefined()
    expect(picker?.codigo).not.toMatch(/from ["']@\/lib\/tenant["']/)
    expect(picker?.codigo).not.toMatch(/tenant\.config/)
  })

  it("nenhum arquivo `use client` importa `@/lib/tenant` ou `tenant.config`", () => {
    const faltas = ARQUIVOS.filter(
      ({ rel, fonte, codigo }) =>
        !rel.includes("__tests__/") &&
        ehClientComponent(fonte) &&
        (/from ["']@\/lib\/tenant["']/.test(codigo) ||
          /from ["'][^"']*tenant\.config["']/.test(codigo)),
    ).map((a) => a.rel)
    expect(faltas).toEqual([])
  })
})

describe("D17 — toda rota que consome marca é dinâmica", () => {
  it("layout/page/not-found que importa `@/lib/tenant` declara `force-dynamic`", () => {
    const faltas = ARQUIVOS.filter(({ rel, codigo }) => {
      const ehRota =
        rel.startsWith("app/") && /\/(layout|page|not-found)\.tsx$/.test(`/${rel.split("/").pop()}`)
      if (!ehRota) return false
      const consomeMarca = /["']@\/lib\/tenant["']/.test(codigo)
      if (!consomeMarca) return false
      return !/export const dynamic\s*=\s*["']force-dynamic["']/.test(codigo)
    }).map((a) => a.rel)
    expect(faltas).toEqual([])
  })
})

// ===========================================================================
// A MARCA DA INSTÂNCIA (`PLATFORM_*`) TAMBÉM NÃO PODE VIRAR COISA DE BUILD.
//
// "eximIA Academy" e "Argos Academy" são a MESMA imagem rodando em serviços
// separados. As duas formas de desfazer isso sem produzir erro nenhum:
//
//   • escrever `process.env.PLATFORM_BRAND_NAME` por extenso — o que já não
//     seria inlinado (o Next só inlina `NEXT_PUBLIC_*`), mas é o passo que
//     antecede o próximo e some do lint do olho humano;
//   • batizar a variável de `NEXT_PUBLIC_PLATFORM_*` "para o cliente ver" —
//     e aí o valor É inlinado em build, e a Argos passa a precisar de imagem
//     própria de novo.
// ===========================================================================

describe("as `PLATFORM_*` são lidas do PROCESSO, nunca do artefato", () => {
  const config = readFileSync(TENANT_CONFIG, "utf8")
  const codigoDaConfig = semComentarios(config)

  it("o varredor está mesmo lendo `tenant.config.ts` (senão passa por vazio)", () => {
    expect(codigoDaConfig).toContain("marcaDaInstancia")
    expect(codigoDaConfig).toContain("PLATFORM_BRAND_NAME")
  })

  it("nenhum acesso LITERAL a `process.env.PLATFORM_*` em `tenant.config.ts`", () => {
    // O acesso é `env("PLATFORM_...")` -> `process.env[chave]`, dinâmico de
    // propósito: só assim o valor é o do PROCESSO, e não o do build.
    expect(codigoDaConfig).not.toMatch(/process\.env\.PLATFORM_/)
  })

  it("nenhum arquivo de `src/` lê `process.env.PLATFORM_*` por extenso", () => {
    const faltas = ARQUIVOS.filter(
      ({ rel, codigo }) =>
        rel !== "__tests__/marca-nao-volta-para-o-build.test.ts" &&
        /process\.env\.PLATFORM_/.test(codigo),
    ).map((a) => a.rel)
    expect(faltas).toEqual([])
  })

  it("`NEXT_PUBLIC_PLATFORM_*` não existe em lugar nenhum — nem em `src/`, nem na config", () => {
    // Este é o regresso que realmente custa caro: o prefixo faz o Next INLINAR
    // o valor no bundle em build, e a instância volta a ser propriedade da
    // IMAGEM em vez de propriedade do SERVIÇO.
    const faltas = ARQUIVOS.filter(
      ({ rel, codigo }) =>
        rel !== "__tests__/marca-nao-volta-para-o-build.test.ts" &&
        codigo.includes("NEXT_PUBLIC_PLATFORM_"),
    ).map((a) => a.rel)
    expect(faltas).toEqual([])
    expect(codigoDaConfig).not.toContain("NEXT_PUBLIC_PLATFORM_")
  })

  it("`tenant.config.ts` não é importado por nenhum componente de CLIENTE", () => {
    // A mesma trava do bloco acima, dita do lado da instância: no navegador
    // `process.env` não existe, e a instância inteira cairia no NEUTRO eximIA
    // dentro de um serviço da Argos — em silêncio, só na metade cliente da
    // página.
    const faltas = ARQUIVOS.filter(
      ({ rel, fonte, codigo }) =>
        !rel.includes("__tests__/") &&
        ehClientComponent(fonte) &&
        /from ["'][^"']*tenant\.config["']/.test(codigo),
    ).map((a) => a.rel)
    expect(faltas).toEqual([])
  })
})
