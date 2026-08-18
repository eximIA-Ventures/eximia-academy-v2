import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { ACAO_POR_ESTADO, ROTULO_ESTADO } from "../tipos"

/**
 * I-7 · a gaveta de pessoa não pode carregar conteúdo protegido.
 *
 * A §30 é explícita sobre o que NÃO entra nesta superfície: profundidade da
 * reflexão, avaliação de competência, conteúdo privado da reflexão e
 * interpretação psicológica. O invariante I-7 diz por que isso não é preferência
 * de produto: é restrição legal, e uma reescrita que reorganiza blocos pode
 * arrastar conteúdo protegido para uma tela onde ele não podia estar.
 *
 * A gaveta é exatamente o tipo de peça que corre esse risco, porque ela é uma
 * ficha DE PESSOA e a tentação de "enriquecer" é permanente.
 *
 * MECANISMO — varredura ESTÁTICA sobre o contrato e sobre o componente, no
 * mesmo espírito de `visao-geral/__tests__/i-7-gate-lgpd.test.ts` (que varre a
 * camada de leitura procurando coluna de conteúdo em `slide_reflections`).
 *
 * POR QUE ESTÁTICA E NÃO DE RUNTIME: um teste de runtime só cobre os caminhos
 * que ele instancia. O campo proibido entraria numa fixture que o teste não
 * conhece, e passaria. A varredura pega o campo no dia em que ele é ESCRITO.
 *
 * CONTROLE POSITIVO: o mesmo detector é aplicado a um texto plantado que contém
 * um dos termos. Se ele não acusar o plantado, ele é cego e o verde dos dois
 * arquivos reais não significa nada.
 */

const RAIZ = join(__dirname, "..", "..", "..", "..")

/**
 * Os termos que denunciam conteúdo protegido chegando à ficha.
 *
 * Cada um é um NOME DE CAMPO plausível, não uma palavra solta: o alvo é a
 * declaração `algumaCoisa: string`, não a prosa do comentário que explica por
 * que ela não existe. Daí o `:` obrigatório na expressão — sem ele, este mesmo
 * arquivo e o cabeçalho de `tipos.ts` (que citam os quatro termos para
 * proibi-los) acusariam a si mesmos, e o gate reprovaria por descrever o próprio
 * defeito.
 */
const CAMPOS_PROIBIDOS = [
  "reflexao",
  "reflection",
  "reflectionText",
  "conteudoReflexao",
  "verbatim",
  "transcript",
  "competencia",
  "competency",
  "avaliacaoDeCompetencia",
  "profundidade",
  "interpretacao",
  "psicolog",
  "sentimento",
  "sentiment",
]

/** `nomeDoCampo:` numa declaração ou num literal de objeto. */
function declaraCampo(fonte: string, termo: string): boolean {
  return new RegExp(`\\b\\w*${termo}\\w*\\s*[?]?\\s*:`, "i").test(fonte)
}

function ler(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), "utf8")
}

describe("I-7 · a gaveta não carrega conteúdo protegido", () => {
  it("CONTROLE POSITIVO — o detector acusa um campo plantado", () => {
    // Sem isto, um detector quebrado devolveria verde para tudo e o teste
    // inteiro passaria a ser decoração.
    const plantado = "export interface X { profundidadeDaReflexao: number }"
    expect(CAMPOS_PROIBIDOS.some((t) => declaraCampo(plantado, t))).toBe(true)
    // E acusa o termo certo, não um qualquer.
    expect(declaraCampo(plantado, "profundidade")).toBe(true)
    // O detector NÃO acusa prosa: "conteúdo privado da reflexão não entra aqui"
    // é exatamente o que os cabeçalhos dizem, e não pode reprovar.
    expect(declaraCampo("// conteudo privado da reflexao nao entra", "reflexao")).toBe(false)
  })

  it("INVARIÂNCIA — o contrato da gaveta não declara nenhum campo proibido", () => {
    const fonte = ler("lib/analytics/gaveta/tipos.ts")
    for (const termo of CAMPOS_PROIBIDOS) {
      expect(declaraCampo(fonte, termo), `campo com "${termo}" em gaveta/tipos.ts`).toBe(false)
    }
  })

  it("INVARIÂNCIA — o componente da gaveta não lê nenhum campo proibido", () => {
    const fonte = ler("components/analytics/gaveta/gaveta.tsx")
    for (const termo of CAMPOS_PROIBIDOS) {
      expect(declaraCampo(fonte, termo), `campo com "${termo}" em gaveta.tsx`).toBe(false)
    }
  })

  it("INVARIÂNCIA — os produtores de ficha não declaram campo proibido", () => {
    for (const caminho of [
      "lib/analytics/visao-geral/gaveta.ts",
      "lib/analytics/mapa-jornada/detalhes.ts",
    ]) {
      const fonte = ler(caminho)
      for (const termo of CAMPOS_PROIBIDOS) {
        expect(declaraCampo(fonte, termo), `campo com "${termo}" em ${caminho}`).toBe(false)
      }
    }
  })

  it("INVARIÂNCIA — a ficha tem exatamente os 8 campos da §30, e nada além", () => {
    // A §30 lista: nome, status atual, curso, progresso, último acesso,
    // frequência recente, sinal identificado, ação recomendada. Os três campos a
    // mais (`id`, `iniciais`, `avatarTone`, `estado`) são identidade e desenho,
    // não conteúdo sobre a pessoa — e `estado` é o discriminante que o portão de
    // acionamento usa. Congelar a lista é o que faz um campo novo passar por
    // revisão em vez de entrar de carona.
    const fonte = ler("lib/analytics/gaveta/tipos.ts")
    const corpo = fonte.slice(
      fonte.indexOf("export interface PessoaDaGaveta"),
      fonte.indexOf("export type AlinhamentoColuna"),
    )
    const campos = [...corpo.matchAll(/^\s{2}(\w+)\s*[?]?:/gm)].map((m) => m[1])
    expect(campos).toEqual([
      "id",
      "nome",
      "iniciais",
      "avatarTone",
      "estado",
      "statusRotulo",
      "cursoRotulo",
      "progressoLabel",
      "ultimoAcessoLabel",
      "frequenciaLabel",
      "sinalLabel",
      "acaoLabel",
    ])
  })

  it("I-8 — quem CONCLUIU não recebe ação de cobrança nem na FALA da ficha", () => {
    // O defeito de 2026-08-17 passou primeiro pela frase e só depois pelo
    // destinatário. Fechar só o envio deixaria a tela continuar pedindo a coisa
    // errada, com o botão desabilitado.
    expect(ACAO_POR_ESTADO.concluido).toBe("Nada a acionar: a jornada foi concluída")
    expect(ROTULO_ESTADO.concluido).toBe("Concluiu a jornada")
    for (const [estado, acao] of Object.entries(ACAO_POR_ESTADO)) {
      for (const punitivo of ["cobrar", "cobrança", "advertir", "penalizar", "notificar falta"]) {
        expect(acao.toLowerCase(), `${estado}: "${acao}"`).not.toContain(punitivo)
      }
    }
  })
})
