import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

// ===========================================================================
// GATE 2 DA MARCA — O QUE O NEXT REALMENTE INLINOU (roda DEPOIS do build)
//
// O gate 1 (`verificar-marca.mjs`) olha a DECLARAÇÃO e diz isso de si mesmo no
// próprio cabeçalho: "sozinho ele não prova nada sobre o produto, e é por isso
// que existem dois". O gate 2 nunca foi escrito — o único gate que rodava era
// aquele que o autor declara textualmente não provar nada sobre o produto
// (achado A-3).
//
// O modo de falha que só o gate 2 pega: as variáveis chegam ao estágio
// `builder` e o gate 1 aprova, mas o `next build` roda dentro do `turbo` e o
// bundle sai NEUTRO mesmo assim (env estrito do Turbo que não casa o padrão,
// um `.env.production` adicionado depois, mudança na regra de inline do Next).
// Build verde, marca da eximIA entregue ao cliente pagante, ninguém sabe sem
// abrir o artefato.
//
// Mesmo contrato de teste do gate 1: executa o BINÁRIO e afirma sobre o EXIT
// CODE, porque é só isso que o Dockerfile consome. E cada verde vem emparelhado
// com um vermelho no mesmo eixo — um gate que aprovasse tudo passaria em metade
// destes testes, em nenhum par completo.
// ===========================================================================

const RAIZ = resolve(process.cwd(), "..", "..")
const SCRIPT = resolve(RAIZ, "apps/web/scripts/verificar-marca-no-artefato.mjs")

const temporarios: string[] = []

afterEach(() => {
  for (const dir of temporarios.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/**
 * Um `.next` de mentira com o conteúdo que o teste quiser inlinado. O gate 2
 * mede BYTES do artefato, então o dublê certo é o artefato, não o build: rodar
 * `next build` de verdade aqui trocaria um teste de 20ms por um de minutos e
 * mediria o Next, não o gate.
 */
function artefato(conteudo: string, caminho = "static/chunks/app/layout-abc123.js"): string {
  const raiz = mkdtempSync(join(tmpdir(), "marca-artefato-"))
  temporarios.push(raiz)
  const arquivo = join(raiz, caminho)
  mkdirSync(resolve(arquivo, ".."), { recursive: true })
  writeFileSync(arquivo, conteudo, "utf8")
  return raiz
}

/** `.next` que existe mas não tem um único `.js` — o "build não rodou". */
function artefatoVazio(): string {
  const raiz = mkdtempSync(join(tmpdir(), "marca-artefato-vazio-"))
  temporarios.push(raiz)
  mkdirSync(join(raiz, "static", "chunks"), { recursive: true })
  return raiz
}

function rodar(env: Record<string, string>, dirDoArtefato: string) {
  const ambiente: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? "",
    NODE_ENV: "test",
    ...env,
  }
  try {
    const saida = execFileSync("node", [SCRIPT, dirDoArtefato], {
      env: ambiente,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    return { code: 0, saida }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? -1, saida: `${err.stdout ?? ""}${err.stderr ?? ""}` }
  }
}

/** A identidade declarada de um cliente, igual à do gate 1. */
const CLIENTE = {
  MARCA_ESPERADA_SLUG: "cory-alimentos",
  NEXT_PUBLIC_TENANT_SLUG: "cory-alimentos",
  NEXT_PUBLIC_TENANT_NAME: "Cory Alimentos",
  NEXT_PUBLIC_TENANT_LOGO: "/logos/cory-white.png",
  NEXT_PUBLIC_TENANT_LOGO_LIGHT: "/logos/cory-color.png",
  NEXT_PUBLIC_TENANT_FAVICON: "/logos/cory-favicon.png",
  NEXT_PUBLIC_TENANT_PRIMARY_COLOR: "#0d3b2e",
  NEXT_PUBLIC_TENANT_ACCENT_COLOR: "#c8a24a",
}

/** O bundle como sai quando a identidade REALMENTE foi inlinada. */
const BUNDLE_DO_CLIENTE = `self.__c=[[9],{412:e=>{e.exports={brand:{name:"Cory Alimentos",slug:"cory-alimentos",logo:"/logos/cory-white.png",logoLight:"/logos/cory-color.png",favicon:"/logos/cory-favicon.png",primaryColor:"#0d3b2e",accentColor:"#c8a24a"}}}}]`

/** O MESMO build, com as variáveis não tendo alcançado o `next build`. */
const BUNDLE_NEUTRO = `self.__c=[[9],{412:e=>{e.exports={brand:{name:"eximIA Academy",slug:"demo",logo:"/brand/logo.png",logoLight:"/brand/logo-color.png",favicon:"/brand/favicon.ico",primaryColor:"#2a6ab0",accentColor:"#C4A882"}}}}]`

describe("gate 2 — build de cliente", () => {
  it("APROVA quando a identidade declarada está de fato inlinada no artefato", () => {
    const { code, saida } = rodar(CLIENTE, artefato(BUNDLE_DO_CLIENTE))

    expect(code).toBe(0)
    expect(saida).toMatch(/cory-alimentos/)
  })

  it("REPROVA o build que declara o cliente e entrega o bundle NEUTRO", () => {
    // Este é o A-3 inteiro: gate 1 verde, produto com a marca errada.
    const { code, saida } = rodar(CLIENTE, artefato(BUNDLE_NEUTRO))

    expect(code).not.toBe(0)
    expect(saida).toMatch(/NEXT_PUBLIC_TENANT_SLUG|cory-alimentos/)
  })

  it("REPROVA quando só PARTE da identidade foi inlinada (marca pela metade)", () => {
    const meiaMarca = BUNDLE_DO_CLIENTE.replace(
      '"/logos/cory-color.png"',
      '"/brand/logo-color.png"',
    )

    const { code, saida } = rodar(CLIENTE, artefato(meiaMarca))

    expect(code).not.toBe(0)
    expect(saida).toMatch(/LOGO_LIGHT/)
  })
})

describe("gate 2 — build neutro declarado", () => {
  it("APROVA o neutro declarado cujo artefato é de fato o neutro", () => {
    const { code } = rodar({ MARCA_ESPERADA_SLUG: "neutro" }, artefato(BUNDLE_NEUTRO))

    expect(code).toBe(0)
  })

  it("REPROVA o neutro declarado cujo artefato saiu com marca de cliente", () => {
    const { code, saida } = rodar({ MARCA_ESPERADA_SLUG: "neutro" }, artefato(BUNDLE_DO_CLIENTE))

    expect(code).not.toBe(0)
    expect(saida).toMatch(/neutro/i)
  })
})

describe("gate 2 — ausência de informação REPROVA, nunca vira OK", () => {
  it("sem MARCA_ESPERADA_SLUG, reprova — igual ao gate 1", () => {
    const { code, saida } = rodar({}, artefato(BUNDLE_NEUTRO))

    expect(code).not.toBe(0)
    expect(saida).toMatch(/MARCA_ESPERADA_SLUG/)
  })

  it("artefato inexistente reprova, em vez de 'nada a verificar, OK'", () => {
    const { code, saida } = rodar(CLIENTE, join(tmpdir(), "nao-existe-marca-artefato-xyz"))

    expect(code).not.toBe(0)
    expect(saida).toMatch(/artefato/i)
  })

  it("artefato sem nenhum arquivo .js reprova (o build não produziu bundle)", () => {
    const { code, saida } = rodar(CLIENTE, artefatoVazio())

    expect(code).not.toBe(0)
    expect(saida).toMatch(/nenhum/i)
  })
})
