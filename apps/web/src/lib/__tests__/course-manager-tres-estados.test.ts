import { describe, expect, it, vi } from "vitest"
import { requireCourseManager } from "../course-management-guard"

// ---------------------------------------------------------------------------
// `requireCourseManager` tem DOIS estados onde a realidade tem TRÊS.
// ---------------------------------------------------------------------------
// Última família conhecida do E→NEGA (laudo LOOP-0c). Mesma omissão das 47 rotas
// já corrigidas, em terreno pior:
//
//     const { data: profile } = await supabase.from("users")
//       .select("role, tenant_id, user_roles!…(role)").eq("id", userId).single()
//     if (!profile) return { ok: false, error: "Perfil não encontrado" }
//
// O `error` do `.single()` nunca é destructurado. Num timeout de statement `data`
// volta `null`, e o guard responde `ok:false` — indistinguível de "este usuário
// não tem chapéu de instrutor". Os 16 chamadores de produção traduzem esse
// `ok:false` em 403, `redirect`, `{ error }` ou `throw`. Um instrutor legítimo é
// expulso da própria página de edição e lê que não tem permissão.
//
// POR QUE ESTE GUARD É PIOR QUE OS OUTROS 47: ele decide sobre a UNIÃO de chapéus
// de `user_roles` (multi-chapéu E1/E7), e é o gate de privacidade que a correção
// `fix-manager-privacy-gates` estabeleceu. Recusar por falha de leitura aqui não
// só mente para o usuário — imita exatamente a recusa legítima que separa a lente
// do gestor da do instrutor, e portanto passa despercebida como "o gate funcionando".
//
// A DECISÃO DE PROJETO que estes testes trancam:
//   • `PGRST116` (zero linhas) → RECUSA legítima. A leitura ACONTECEU e o veredito
//     é "não há perfil". Idêntico ao que as 47 rotas fazem.
//   • qualquer outro `error` → INDISPONIBILIDADE. A leitura não aconteceu, e uma
//     leitura que não aconteceu não autoriza ninguém a dizer "permissão negada".
//
// CONTROLE POSITIVO ([CP]): passam ANTES e DEPOIS. Travam a correção degenerada
// "responde indisponível sempre", que apagaria o gate de privacidade inteiro.
// ---------------------------------------------------------------------------

/** O erro que o PostgREST devolve num timeout de statement. Transitório por definição. */
const ERRO_TRANSITORIO = {
  code: "57014",
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
}

/** O "erro" de zero linhas do `.single()`. NÃO é indisponibilidade: o perfil não existe. */
const ERRO_ZERO_LINHAS = {
  code: "PGRST116",
  message: "JSON object requested, multiple (or no) rows returned",
  details: null,
  hint: null,
}

type Linha = { role: string | null; tenant_id: string | null; user_roles: { role: string }[] }

/**
 * Duplo que, ao contrário do stub do arquivo irmão, permite ditar `error`
 * separadamente de `data` — que é justamente a dimensão que o guard ignora hoje.
 */
function clienteFake(data: Linha | null, error: unknown = null) {
  return {
    from(tabela: string) {
      if (tabela !== "users") throw new Error(`tabela inesperada: ${tabela}`)
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data, error }),
          }),
        }),
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny: duplo da fatia estreita que o guard usa
  } as any
}

const INSTRUTOR: Linha = {
  role: "manager",
  tenant_id: "tenant-1",
  user_roles: [{ role: "instructor" }, { role: "manager" }],
}

describe("requireCourseManager — falha de leitura não é recusa de permissão", () => {
  it("erro transitório na leitura do perfil NÃO pode virar recusa", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const supabase = clienteFake(null, ERRO_TRANSITORIO)

    const resultado = await requireCourseManager(supabase, "rinaldo")

    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error("esperava recusa")
    // O coração do defeito: hoje isto é indistinguível de "não tem chapéu".
    expect(resultado.motivo).toBe("indisponivel")
    expect(resultado.motivo).not.toBe("sem-permissao")
  })

  it("[CP] perfil inexistente (PGRST116) continua RECUSA, não indisponibilidade", async () => {
    // Zero linhas é veredito, não falha: a leitura aconteceu e a resposta é "não
    // há perfil". Chamar isto de indisponível esconderia um usuário órfão atrás
    // de um "tente de novo" que jamais resolveria.
    const supabase = clienteFake(null, ERRO_ZERO_LINHAS)

    const resultado = await requireCourseManager(supabase, "fantasma")

    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error("esperava recusa")
    expect(resultado.motivo).toBe("sem-permissao")
  })

  it("[CP] chapéu de gestor puro continua RECUSA — o gate de privacidade não pode afrouxar", async () => {
    // Se a correção transformasse toda recusa em "indisponível", este caso
    // ficaria vermelho — e ele é a razão de o guard existir.
    const supabase = clienteFake({
      role: "manager",
      tenant_id: "tenant-1",
      user_roles: [{ role: "manager" }],
    })

    const resultado = await requireCourseManager(supabase, "caio")

    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error("esperava recusa")
    expect(resultado.motivo).toBe("sem-permissao")
  })

  it("[CP] chapéu de instrutor continua atravessando (multi-chapéu preservado)", async () => {
    const supabase = clienteFake(INSTRUTOR)

    const resultado = await requireCourseManager(supabase, "rinaldo")

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error("esperava permissão")
    expect(resultado.ctx.hats).toEqual(["instructor", "manager"])
  })
})
