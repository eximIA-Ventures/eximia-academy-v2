import { describe, expect, it } from "vitest"
import { resumirMatriculas, triarPorConclusao } from "../acionamento-alvo"

/**
 * O CRITÉRIO DE CONCLUSÃO É UM SÓ, e agora os dois lados o compartilham.
 *
 * DEFEITO DE ORIGEM (auditoria independente, 2026-08-19): `triarDestinatarios`
 * barrava quem CONCLUIU, mas rodava no NAVEGADOR. O servidor
 * (`api/engagement/action`) não tinha o filtro, e a Central de Engajamento posta
 * nele. Fechar o buraco exigia a mesma pergunta no servidor — e reescrevê-la lá
 * teria criado a SEGUNDA implementação, que é exatamente como o buraco nasce.
 *
 * Então o critério que morava dentro de `base.ts`
 * (`matriculadas > 0 && completadas === matriculadas`) saiu de lá e virou
 * `resumirMatriculas`, aqui. `base.ts` consome, a rota consome. Este arquivo é o
 * que impede o critério de mudar de um lado só.
 *
 * CONTROLE POSITIVO — a fixture tem concluído E não-concluído, e cada cenário
 * afirma os dois lados. Uma função degenerada (devolve conjunto vazio, ou marca
 * todo mundo) reprova aqui.
 */

const ANA = "ana"
const BRUNO = "bruno"

describe("resumirMatriculas — quem concluiu", () => {
  it("CONTROLE POSITIVO — a fixture separa concluído de não-concluído", () => {
    const { concluidos } = resumirMatriculas([
      { student_id: ANA, status: "active", deleted_at: null },
      { student_id: BRUNO, status: "completed", deleted_at: null },
    ])
    expect(concluidos.has(BRUNO)).toBe(true)
    expect(concluidos.has(ANA)).toBe(false)
    expect(concluidos.size).toBe(1)
  })

  it("uma matrícula AINDA EM CURSO derrruba a conclusão", () => {
    // "Terminou um curso" não é "terminou a jornada". Quem tem trilha aberta
    // pode ser legitimamente chamado de volta a ela.
    const { concluidos } = resumirMatriculas([
      { student_id: BRUNO, status: "completed", deleted_at: null },
      { student_id: BRUNO, status: "active", deleted_at: null },
    ])
    expect(concluidos.has(BRUNO)).toBe(false)
  })

  it("SEM matrícula nenhuma NÃO é conclusão — o critério exige ao menos uma viva", () => {
    // O `> 0` da fórmula. Ler ausência como conclusão barraria gente que a
    // Central alcança legitimamente hoje — o erro simétrico, e caro.
    const { concluidos } = resumirMatriculas([])
    expect(concluidos.size).toBe(0)
  })

  it("VARIÂNCIA — o par-espelho: só o `deleted_at` muda, e só ele decide", () => {
    const viva = [
      { student_id: BRUNO, status: "completed", deleted_at: null },
      { student_id: BRUNO, status: "active", deleted_at: null },
    ]
    const apagada = [
      { student_id: BRUNO, status: "completed", deleted_at: null },
      { student_id: BRUNO, status: "active", deleted_at: "2026-01-02T00:00:00Z" },
    ]
    expect(resumirMatriculas(viva).concluidos.has(BRUNO)).toBe(false)
    expect(resumirMatriculas(apagada).concluidos.has(BRUNO)).toBe(true)
  })

  it("matrícula apagada não conta em NENHUM dos dois lados da fração", () => {
    // Contá-la só no denominador tiraria a conclusão de quem terminou; contá-la
    // só no numerador daria conclusão a quem não terminou.
    const r = resumirMatriculas([
      { student_id: ANA, status: "completed", deleted_at: "2026-01-02T00:00:00Z" },
      { student_id: ANA, status: "active", deleted_at: null },
    ])
    expect(r.matriculadasPorAluno.get(ANA)).toBe(1)
    // Sem nenhuma completada VIVA a chave nem é criada — e `base.ts` lê este
    // mapa com `?? 0` (`coursesCompleted`). A asserção é `has(...) === false`, e
    // não `get(...) === 0`, porque é ESSA a semântica que o consumidor espera;
    // exigir o zero explícito mudaria o mapa sem que ninguém tivesse pedido.
    expect(r.completadasPorAluno.has(ANA)).toBe(false)
    expect(r.concluidos.has(ANA)).toBe(false)
  })

  it("`deleted_at` AUSENTE é matrícula viva — é a forma que a Visão geral recebe", () => {
    // `fonte-supabase.ts` já corta `deleted_at` no banco e entrega linhas sem a
    // coluna. Se ausência fosse lida como apagada, `base.ts` passaria a não ver
    // conclusão nenhuma na tela inteira.
    const { concluidos, matriculadasPorAluno } = resumirMatriculas([
      { student_id: BRUNO, status: "completed" },
    ])
    expect(matriculadasPorAluno.get(BRUNO)).toBe(1)
    expect(concluidos.has(BRUNO)).toBe(true)
  })

  it("as contagens são as que a tabela mostra (`coursesEnrolled` / `coursesCompleted`)", () => {
    const r = resumirMatriculas([
      { student_id: ANA, status: "completed", deleted_at: null },
      { student_id: ANA, status: "active", deleted_at: null },
      { student_id: ANA, status: "cancelled", deleted_at: null },
    ])
    expect(r.matriculadasPorAluno.get(ANA)).toBe(3)
    expect(r.completadasPorAluno.get(ANA)).toBe(1)
  })
})

describe("triarPorConclusao — o núcleo, sem eixo de ignorância", () => {
  it("cobrança barra o concluído e libera o resto, na ordem de chegada (I-8)", () => {
    const t = triarPorConclusao([ANA, BRUNO], "inactive", new Set([BRUNO]))
    expect(t.permitidos).toEqual([ANA])
    expect(t.bloqueadosPorConclusao).toEqual([BRUNO])
  })

  it("ausência do conjunto é o FATO 'não concluiu', não falta de informação", () => {
    // Diferença deliberada em relação a `triarDestinatarios`: lá, um id fora do
    // mapa é ignorância do cliente e é BARRADO. Aqui quem chama leu as
    // matrículas com sucesso, então quem não está no conjunto simplesmente não
    // concluiu — e barrá-lo tiraria do ar o envio a todo aluno sem matrícula.
    const t = triarPorConclusao(["desconhecido"], "inactive", new Set())
    expect(t.permitidos).toEqual(["desconhecido"])
    expect(t.bloqueadosPorConclusao).toEqual([])
  })

  it("reconhecimento e comunicado alcançam quem concluiu", () => {
    for (const tipo of ["top_performer", "announcement"] as const) {
      const t = triarPorConclusao([ANA, BRUNO], tipo, new Set([BRUNO]))
      expect(t.permitidos, tipo).toEqual([ANA, BRUNO])
      expect(t.bloqueadosPorConclusao, tipo).toEqual([])
    }
  })
})
