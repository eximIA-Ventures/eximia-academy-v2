import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

// ===========================================================================
// O `redirectTo` DOS E-MAILS TEM QUE EXISTIR COMO ROTA (D11)
//
// O defeito que este arquivo trava: os dois call-sites de convite mandavam o
// GoTrue redirecionar para `/auth/accept-invite`. A página de aceite mora em
// `app/(auth)/accept-invite/page.tsx` — e `(auth)` é ROUTE GROUP, que NÃO vira
// segmento de URL. Não existe `app/auth/` no repositório, não há rewrite em
// `next.config.ts` e o middleware não reescreve `/auth/*`. O primeiro admin de
// uma empresa nova clicava no convite e caía no 404: a empresa nascia sem
// ninguém dentro.
//
// Ficava invisível porque o host do convite não estava na allowlist de
// Redirect URLs do Supabase, e o GoTrue reescrevia em silêncio para a
// `Site URL`. Com o passo §7.2 do guia (`https://*.{base}/**` na allowlist) o
// `redirectTo` passa a ser honrado — e o 404 vira real.
//
// Por isso o teste é de FONTE, e não de comportamento: o erro não aparece em
// nenhum unitário de rota (o `redirectTo` é só uma string opaca para o mock do
// GoTrue), só num navegador, em produção, depois do e-mail sair.
// ===========================================================================

const RAIZ = resolve(__dirname, "..")
const APP = join(RAIZ, "app")

/** Todos os caminhos de URL que `app/` de fato serve (page.tsx / route.ts). */
function rotasDoApp(dir: string, urlAtual = ""): string[] {
  const achadas: string[] = []
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada)
    if (statSync(caminho).isDirectory()) {
      // `(grupo)` é route group: organiza arquivos, não entra na URL.
      // `_pasta` é privada: o Next nem a roteia.
      if (entrada.startsWith("_")) continue
      const segmento = entrada.startsWith("(") && entrada.endsWith(")") ? "" : `/${entrada}`
      achadas.push(...rotasDoApp(caminho, `${urlAtual}${segmento}`))
    } else if (/^(page|route)\.(t|j)sx?$/.test(entrada)) {
      achadas.push(urlAtual === "" ? "/" : urlAtual)
    }
  }
  return achadas
}

const ROTAS = new Set(rotasDoApp(APP))

/** Os arquivos que montam link de e-mail com `${baseUrl}` (D11). */
const CALL_SITES = [
  "app/api/admin/users/invite-user.ts",
  "app/api/admin/users/[userId]/resend-invite/route.ts",
]

function caminhosDeRedirect(arquivo: string): string[] {
  const fonte = readFileSync(join(RAIZ, arquivo), "utf-8")
  return [...fonte.matchAll(/redirectTo:\s*`\$\{baseUrl\}([^`]*)`/g)].map((m) => m[1])
}

describe("o `redirectTo` do convite aponta para uma rota que existe em app/", () => {
  it("o app roteia `/accept-invite` (e NÃO `/auth/accept-invite`)", () => {
    expect(ROTAS.has("/accept-invite")).toBe(true)
    expect(ROTAS.has("/auth/accept-invite")).toBe(false)
  })

  for (const arquivo of CALL_SITES) {
    it(`${arquivo} só usa caminhos servidos por app/`, () => {
      const caminhos = caminhosDeRedirect(arquivo)
      expect(caminhos.length).toBeGreaterThan(0)
      for (const caminho of caminhos) {
        const semQuery = caminho.split("?")[0].split("#")[0]
        expect(
          ROTAS.has(semQuery),
          `${arquivo}: \`${semQuery}\` não é servido por nenhum page.tsx/route.ts de app/ — o convite cairia no 404`,
        ).toBe(true)
      }
    })
  }
})
