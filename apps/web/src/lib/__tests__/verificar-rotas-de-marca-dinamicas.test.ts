import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { ROTAS_DE_MARCA, verificar } from "../../../scripts/verificar-rotas-de-marca-dinamicas.mjs"

// ===========================================================================
// GATE D17 — nenhuma rota de marca pode sair pré-renderizada estaticamente.
//
// Mesmo contrato de teste dos gates antigos (`verificar-marca-no-artefato`):
// o dublê certo é o ARTEFATO (`prerender-manifest.json` sintético em tmpdir),
// não um `next build` de verdade — isso trocaria um teste de milissegundos por
// um de minutos e mediria o Next, não o gate. E o binário é exercitado via
// CLI/exit-code, porque é só isso que o Dockerfile consome.
// ===========================================================================

const RAIZ = resolve(process.cwd(), "..", "..")
const SCRIPT = resolve(RAIZ, "apps/web/scripts/verificar-rotas-de-marca-dinamicas.mjs")

const temporarios: string[] = []

afterEach(() => {
  for (const dir of temporarios.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Um `.next` de mentira com o `prerender-manifest.json` que o teste quiser. */
function artefatoComManifesto(manifest: unknown): string {
  const raiz = mkdtempSync(join(tmpdir(), "rotas-marca-"))
  temporarios.push(raiz)
  writeFileSync(join(raiz, "prerender-manifest.json"), JSON.stringify(manifest), "utf8")
  return raiz
}

function rodar(dirArtefato: string): { codigo: number; saida: string } {
  try {
    const saida = execFileSync("node", [SCRIPT, dirArtefato], { encoding: "utf8" })
    return { codigo: 0, saida }
  } catch (erro) {
    const e = erro as { status?: number; stdout?: string; stderr?: string }
    return { codigo: e.status ?? 1, saida: `${e.stdout ?? ""}${e.stderr ?? ""}` }
  }
}

describe("verificar() — função pura", () => {
  it("aprova um manifesto sem nenhuma rota de marca em `routes`", () => {
    const { erros } = verificar({ routes: { "/algum-outro-caminho": {} }, dynamicRoutes: {} })
    expect(erros).toEqual([])
  })

  it("aprova um manifesto totalmente vazio", () => {
    const { erros } = verificar({ routes: {}, dynamicRoutes: {} })
    expect(erros).toEqual([])
  })

  it.each(ROTAS_DE_MARCA)('reprova quando "%s" está em `routes` (saiu estática)', (rota) => {
    const { erros } = verificar({ routes: { [rota]: {} }, dynamicRoutes: {} })
    expect(erros).toHaveLength(1)
    expect(erros[0]).toContain(rota)
  })

  it("reprova com uma mensagem por rota de marca estática, todas de uma vez", () => {
    const { erros } = verificar({
      routes: { "/login": {}, "/dashboard": {}, "/rota-irrelevante": {} },
      dynamicRoutes: {},
    })
    expect(erros).toHaveLength(2)
  })

  it("não derruba com `routes` ausente do manifesto", () => {
    expect(() => verificar({ dynamicRoutes: {} })).not.toThrow()
    expect(verificar({ dynamicRoutes: {} }).erros).toEqual([])
  })
})

describe("CLI — exit code (o que o Dockerfile realmente consome)", () => {
  it("sai 0 quando nenhuma rota de marca é estática", () => {
    const dir = artefatoComManifesto({ routes: { "/outra": {} }, dynamicRoutes: {} })
    const { codigo, saida } = rodar(dir)
    expect(codigo).toBe(0)
    expect(saida).toContain("OK")
  })

  it("sai != 0 quando uma rota de marca é estática", () => {
    const dir = artefatoComManifesto({ routes: { "/login": {} }, dynamicRoutes: {} })
    const { codigo, saida } = rodar(dir)
    expect(codigo).not.toBe(0)
    expect(saida).toContain("/login")
  })

  it("sai != 0 (fail-closed) quando o diretório do artefato não existe", () => {
    const inexistente = join(tmpdir(), "rotas-marca-jamais-criado-xyz")
    const { codigo, saida } = rodar(inexistente)
    expect(codigo).not.toBe(0)
    expect(saida).toContain("REPROVADO")
  })

  it("sai != 0 (fail-closed) quando o artefato existe mas falta o prerender-manifest.json", () => {
    const raiz = mkdtempSync(join(tmpdir(), "rotas-marca-sem-manifesto-"))
    temporarios.push(raiz)
    mkdirSync(join(raiz, "static"), { recursive: true })
    const { codigo, saida } = rodar(raiz)
    expect(codigo).not.toBe(0)
    expect(saida).toContain("REPROVADO")
  })

  it("sai != 0 quando o manifesto não é um JSON válido", () => {
    const raiz = mkdtempSync(join(tmpdir(), "rotas-marca-json-invalido-"))
    temporarios.push(raiz)
    writeFileSync(join(raiz, "prerender-manifest.json"), "{ isto nao e json", "utf8")
    const { codigo, saida } = rodar(raiz)
    expect(codigo).not.toBe(0)
    expect(saida).toContain("REPROVADO")
  })
})
