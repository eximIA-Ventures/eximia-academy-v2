import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

// ===========================================================================
// O VERIFICADOR DA MARCA — testado pelo CONTRATO QUE O DOCKERFILE USA
//
// O Dockerfile depende de UMA coisa deste script: o EXIT CODE
// (`RUN node apps/web/scripts/verificar-marca.mjs`, antes do `turbo build`).
// Por isso o teste executa o binario de verdade e afirma sobre o exit code,
// em vez de importar a funcao: importar testaria uma coisa que o build nao
// usa, e deixaria o contrato real sem cobertura.
//
// Cada caso VERDE vem emparelhado com um VERMELHO no mesmo eixo. Um
// verificador que aprovasse tudo passaria em metade destes testes; nenhum
// verificador cego passa nos dois lados do mesmo par.
// ===========================================================================

const RAIZ = resolve(process.cwd(), "..", "..")
const SCRIPT = resolve(RAIZ, "apps/web/scripts/verificar-marca.mjs")

/** Roda o verificador com um ambiente CONTROLADO e devolve exit code + saida. */
function rodar(env: Record<string, string>): { code: number; saida: string } {
  // Ambiente limpo de qualquer NEXT_PUBLIC_TENANT_* herdado do shell de quem
  // roda os testes: senao o caso "neutro" dependeria da maquina.
  // `NODE_ENV` e obrigatorio em `NodeJS.ProcessEnv` (augmentation do Next em
  // next-env.d.ts) — sem ele o `tsc` reprova, nao o vitest.
  const ambiente: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? "",
    NODE_ENV: "test",
    ...env,
  }
  try {
    const saida = execFileSync("node", [SCRIPT], {
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

const MARCA_COMPLETA = {
  NEXT_PUBLIC_TENANT_SLUG: "cory-alimentos",
  NEXT_PUBLIC_TENANT_NAME: "Argos Consultoria",
  NEXT_PUBLIC_TENANT_LOGO: "/logos/argos-academy-color.png",
  NEXT_PUBLIC_TENANT_LOGO_LIGHT: "/logos/argos-academy-color.png",
  NEXT_PUBLIC_TENANT_MODULES: "biblioteca,units",
}

describe("verificar-marca.mjs", () => {
  it("o script existe no caminho que o Dockerfile invoca", () => {
    // Se este teste falhar, o `RUN node apps/web/scripts/verificar-marca.mjs`
    // do Dockerfile quebra o build do cliente na proxima publicacao.
    expect(existsSync(SCRIPT), `esperado em ${SCRIPT}`).toBe(true)
  })

  describe("aprova (exit 0)", () => {
    it("build neutro: nenhuma variavel de marca", () => {
      const { code, saida } = rodar({})
      expect(code, saida).toBe(0)
      expect(saida).toContain("(neutro)")
    })

    it("build de cliente: identidade completa", () => {
      const { code, saida } = rodar(MARCA_COMPLETA)
      expect(code, saida).toBe(0)
      expect(saida).toContain("cory-alimentos")
    })

    it("ancora MARCA_ESPERADA_SLUG batendo com o slug", () => {
      const { code, saida } = rodar({ ...MARCA_COMPLETA, MARCA_ESPERADA_SLUG: "cory-alimentos" })
      expect(code, saida).toBe(0)
    })
  })

  describe("reprova (exit != 0) — cada um e o par vermelho de um verde acima", () => {
    it("slug sem nome: o build sairia com tenant do cliente e NOME neutro", () => {
      const { code, saida } = rodar({ NEXT_PUBLIC_TENANT_SLUG: "cory-alimentos" })
      expect(code).toBe(1)
      expect(saida).toContain("NEXT_PUBLIC_TENANT_NAME")
    })

    it("nome sem slug: marca na tela e telemetria no tenant errado", () => {
      const { code, saida } = rodar({ NEXT_PUBLIC_TENANT_NAME: "Argos Consultoria" })
      expect(code).toBe(1)
      expect(saida).toContain("NEXT_PUBLIC_TENANT_SLUG")
    })

    it("slug sem logo", () => {
      const { code } = rodar({
        NEXT_PUBLIC_TENANT_SLUG: "x",
        NEXT_PUBLIC_TENANT_NAME: "X",
      })
      expect(code).toBe(1)
    })

    it("token de modulo desconhecido (getEnabledModules descartaria em silencio)", () => {
      const { code, saida } = rodar({
        ...MARCA_COMPLETA,
        NEXT_PUBLIC_TENANT_MODULES: "biblioteca,unitss",
      })
      expect(code).toBe(1)
      expect(saida).toContain("unitss")
    })

    it("cor fora de #RRGGBB (a config descartaria em silencio)", () => {
      const { code, saida } = rodar({ ...MARCA_COMPLETA, NEXT_PUBLIC_TENANT_PRIMARY_COLOR: "azul" })
      expect(code).toBe(1)
      expect(saida).toContain("PRIMARY_COLOR")
    })

    it("caminho de asset relativo (nao resolve sob /public)", () => {
      const { code, saida } = rodar({ ...MARCA_COMPLETA, NEXT_PUBLIC_TENANT_LOGO: "logos/x.png" })
      expect(code).toBe(1)
      expect(saida).toContain("TENANT_LOGO")
    })

    it("ancora MARCA_ESPERADA_SLUG divergindo do slug", () => {
      const { code, saida } = rodar({ ...MARCA_COMPLETA, MARCA_ESPERADA_SLUG: "outro-cliente" })
      expect(code).toBe(1)
      expect(saida).toContain("outro-cliente")
    })
  })
})
