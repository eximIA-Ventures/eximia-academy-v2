import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

// ===========================================================================
// UM GATE QUE NINGUÉM CHAMA NÃO É UM GATE.
//
// O achado A-3 tem duas metades. A primeira é o arquivo que não existia. A
// segunda, mais fácil de reintroduzir, é o arquivo existir e o Dockerfile não
// o invocar — foi exatamente assim que o gate 2 "existiu" por meses no
// cabeçalho do gate 1 sem existir no produto. Este teste mede a CHAMADA, não a
// intenção.
//
// A ORDEM É PARTE DO CONTRATO: o gate 1 mede a declaração e roda ANTES do
// build; o gate 2 mede o artefato e só pode rodar DEPOIS dele. Um gate 2
// colocado antes do build mediria o artefato da imagem anterior, ou nada.
// ===========================================================================

const RAIZ = resolve(process.cwd(), "..", "..")
const DOCKERFILE = readFileSync(resolve(RAIZ, "Dockerfile"), "utf8")

const LINHAS = DOCKERFILE.split("\n")

const linhaDe = (agulha: string) =>
  LINHAS.findIndex((l) => l.includes(agulha) && l.trim().startsWith("RUN"))

// ---------------------------------------------------------------------------
// A SEGUNDA METADE DO MESMO DEFEITO: A CHAMADA EXISTE E A FALHA NÃO PROPAGA.
// ---------------------------------------------------------------------------
// Os dois casos acima medem POSIÇÃO — que a linha está lá, e antes/depois do
// build. Medição verdadeira, e cega para o modo de falha mais provável de todos:
// `RUN node …verificar-marca-no-artefato.mjs || true`. A linha continua na
// posição certa, o teste continua verde, e o gate deixou de reprovar qualquer
// coisa. Medido pela verificação cruzada de 2026-08-28 (mutação MC4): **2/2
// VERDE** com o `|| true` no lugar.
//
// `|| true` é o que alguém escreve às onze da noite para destravar um build. Um
// gate cuja falha é engolida não é um gate — é um comentário caro.
//
// POR QUE NÃO GREPAR PELA LITERAL `|| true`: a família de formas que engolem o
// código de saída é grande, e cada membro dela tem a mesma consequência. Varrer
// pela forma do texto é justamente o erro que esta auditoria já pagou caro. As
// quatro que importam, e o motivo de cada uma:
//
//   • `cmd || true`, `cmd || exit 0`, `cmd || :`  → o `||` executa o ramo alternativo
//     quando `cmd` falha, e o status da instrução passa a ser o DELE.
//   • `cmd ; true`                                → em `sh`, o status é o do ÚLTIMO comando.
//   • `cmd | tee log`                             → num pipe sem `pipefail`, idem: vale o último.
//   • `cmd &`                                     → em segundo plano, o status é sempre 0.
//
// A asserção é sobre o RABO da instrução: depois do script (e dos argumentos
// dele) não pode haver separador de comando. `&&` é a única exceção — ele NÃO
// engole nada: se o script falhar, o ramo direito nem roda e a instrução falha.
//
// Vale para os DOIS gates. O gate 1 tem exatamente a mesma exposição, e não há
// motivo para guardar um e deixar o outro.
// ---------------------------------------------------------------------------

/**
 * Reconstrói a instrução `RUN` inteira a partir da linha em que a agulha
 * aparece, colando as continuações `\`. Sem isto, um `\` no fim da linha
 * esconderia o `|| true` na linha seguinte — o teste leria só metade do comando
 * e aprovaria.
 */
function instrucaoRunQueContem(agulha: string): string {
  const inicio = linhaDe(agulha)
  if (inicio < 0) return ""

  const partes: string[] = []
  for (let i = inicio; i < LINHAS.length; i += 1) {
    const linha = LINHAS[i]
    partes.push(linha.replace(/\\\s*$/, ""))
    if (!/\\\s*$/.test(linha)) break
  }
  return partes.join(" ")
}

/**
 * Separadores que fazem o código de saída do gate deixar de ser o da instrução.
 * `&&` é deliberadamente excluído (não engole), e por isso o `&` só conta
 * quando NÃO está acompanhado de outro `&`; o `|` só conta quando não é `||`
 * — e o `||` entra pela primeira alternativa.
 */
const ENGOLE_O_CODIGO_DE_SAIDA = /\|\||;|(?<!\|)\|(?!\|)|(?<!&)&(?!&)/

/** O rabo da instrução: tudo que vem DEPOIS da chamada do script. */
function rabo(agulha: string): string {
  const instrucao = instrucaoRunQueContem(agulha)
  const corte = instrucao.indexOf(agulha)
  return corte < 0 ? "" : instrucao.slice(corte + agulha.length)
}

// ---------------------------------------------------------------------------
// A TERCEIRA METADE: O GATE NEM CHEGA A RODAR.
// ---------------------------------------------------------------------------
// As asserções acima medem POSIÇÃO e RABO. Ambas verdadeiras, e ambas cegas ao
// operador que vem à ESQUERDA da chamada:
//
//   RUN true || node …verificar-marca-no-artefato.mjs                    → 6/6 VERDE
//   RUN [ "$PULAR_GATE" = "1" ] || node …verificar-marca-no-artefato.mjs → 6/6 VERDE
//
// Medido em 2026-08-31. O rabo fica limpo, a linha continua depois do build, e o
// gate NÃO EXECUTA quando a condição da esquerda dá certo — instrução sai 0, o
// build fica verde, e nada foi apagado do arquivo. A segunda forma é a
// realista: o sinalizador de pulo que alguém liga para destravar um build local
// e esquece no `Dockerfile`.
//
// O QUE NÃO PODE ENTRAR NESTA RÉGUA, e é o cuidado que a mantém usável:
//
//   • `cmd && node …` continua VERDE. `&&` não esconde nada — se `cmd` falha, o
//     gate não roda E a instrução falha junto, ruidosamente. Reprovar `&&` seria
//     barrar a forma que alguém usa para registrar contexto antes do gate, e uma
//     régua que atrapalha o inofensivo é desligada na primeira sexta-feira.
//   • `if …; then node … ; fi` NÃO precisa de regra nova: medido, o `; fi` cai no
//     rabo e a asserção anterior já reprova (1 failed | 5 passed). Acrescentar
//     `if` aqui seria régua redundante se fazendo de nova.
//
// A fronteira, então, é estreita e tem nome: reprova o operador que IMPEDE o
// gate de rodar deixando a instrução sair 0; não reprova o que apenas o
// acompanha.
// ---------------------------------------------------------------------------

/**
 * Curto-circuito à esquerda. Só `||` qualifica: ele pula o lado direito
 * justamente quando o esquerdo dá CERTO, que é o caminho por onde a instrução
 * sai 0 sem o gate ter rodado.
 */
const IMPEDE_O_GATE_DE_RODAR = /\|\|/

/** A cabeça da instrução: tudo que vem ANTES da chamada do script. */
function cabeca(agulha: string): string {
  const instrucao = instrucaoRunQueContem(agulha)
  const corte = instrucao.indexOf(agulha)
  return corte < 0 ? "" : instrucao.slice(0, corte)
}

const GATES = [
  { nome: "gate 1 (declaração)", agulha: "scripts/verificar-marca.mjs" },
  { nome: "gate 2 (artefato)", agulha: "scripts/verificar-marca-no-artefato.mjs" },
] as const

describe("Dockerfile — os dois gates da marca são de fato chamados", () => {
  it("chama o gate 1 (declaração) antes do build", () => {
    const gate1 = linhaDe("scripts/verificar-marca.mjs")
    const build = linhaDe("turbo run build")

    expect(gate1).toBeGreaterThan(-1)
    expect(gate1).toBeLessThan(build)
  })

  it("chama o gate 2 (artefato) DEPOIS do build", () => {
    const build = linhaDe("turbo run build")
    const gate2 = linhaDe("scripts/verificar-marca-no-artefato.mjs")

    expect(gate2).toBeGreaterThan(-1)
    expect(gate2).toBeGreaterThan(build)
  })

  for (const gate of GATES) {
    it(`a falha do ${gate.nome} PROPAGA — nada engole o código de saída`, () => {
      const instrucao = instrucaoRunQueContem(gate.agulha)
      // Controle: se a instrução sumisse, este caso ficaria verde por vacuidade
      // (rabo vazio não casa com nada). A presença é afirmada aqui também.
      expect(instrucao, `instrução RUN de ${gate.agulha} não encontrada`).not.toBe("")

      expect(
        rabo(gate.agulha),
        `a chamada do ${gate.nome} tem um separador depois dela (\`||\`, \`;\`, \`|\` ou \`&\`), e o código de saída do gate deixa de ser o da instrução:\n${instrucao}`,
      ).not.toMatch(ENGOLE_O_CODIGO_DE_SAIDA)
    })

    it(`o ${gate.nome} EXECUTA — nada à esquerda o curto-circuita`, () => {
      const instrucao = instrucaoRunQueContem(gate.agulha)
      // Mesmo controle do caso irmão: instrução ausente deixaria a cabeça vazia,
      // e vazio não casa com nada. A presença é afirmada antes da forma.
      expect(instrucao, `instrução RUN de ${gate.agulha} não encontrada`).not.toBe("")

      expect(
        cabeca(gate.agulha),
        `a chamada do ${gate.nome} tem um \`||\` antes dela: quando o lado esquerdo dá certo, o gate NAO RODA e a instrucao sai 0 mesmo assim:\n${instrucao}`,
      ).not.toMatch(IMPEDE_O_GATE_DE_RODAR)
    })

    it(`o ${gate.nome} aceita \`&&\` antes dele — a régua não barra o inofensivo`, () => {
      // Controle da régua acima. `&&` propaga a falha (se o lado esquerdo falha,
      // a instrução falha), então precisa continuar permitido. Este caso existe
      // para que endurecer a régua contra `&&` no futuro fique VERMELHO aqui, em
      // vez de ser descoberto por alguém cujo build parou sem motivo.
      const comEComercial = `RUN echo "medindo a marca" && node apps/web/${gate.agulha}`
      const corte = comEComercial.indexOf(gate.agulha)

      expect(comEComercial.slice(0, corte)).not.toMatch(IMPEDE_O_GATE_DE_RODAR)
    })

    it(`o ${gate.nome} não roda com \`set +e\` desligando a parada`, () => {
      // O irmão silencioso do `|| true`: com `set +e` no início da MESMA
      // instrução, o rabo fica limpo e a falha continua não derrubando o build.
      expect(instrucaoRunQueContem(gate.agulha)).not.toMatch(/set\s+\+e/)
    })
  }
})
