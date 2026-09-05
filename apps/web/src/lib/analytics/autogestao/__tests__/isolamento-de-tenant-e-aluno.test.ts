// ---------------------------------------------------------------------------
// A1-A4 — os filtros de tenant e de aluno da Autogestão, pinados por VAZAMENTO.
// ---------------------------------------------------------------------------
// O DEFEITO QUE ISTO ARRANCA (laudo LOOP-2, Eixo A): os quatro `.eq()` de
// escopo desta camada podiam ser apagados, um a um, e a suíte permanecia
// 235/235 verde. `lerFonteAutogestao` EXECUTA nos testes (`fuso-horario.test.ts`
// a dirige) — os testes atravessavam a consulta e não OLHAVAM para os filtros.
//
// POR QUE ISSO É CRÍTICO E NÃO É DÍVIDA COMUM: o client aqui é o de SERVIÇO
// (`ClienteLeitura = ReturnType<typeof createServiceClient>`). RLS não se
// aplica a este caminho — por desenho, não por descuido. O `.eq("tenant_id",
// …)` da aplicação é a ÚNICA fronteira entre dois clientes pagantes no mesmo
// banco, e esta casa já teve vazamento cross-tenant real chegar a produção em
// 18/08/2026 (ver o cabeçalho de `trava-de-tenant.test.ts`). A trava que
// nasceu daquele incidente protege o script de SEMEADURA, não estas consultas.
//
// COMO ISTO MEDE, e por que não por `grep` nem por spy de `.eq()`: o duplo
// (`banco-que-filtra.ts`) APLICA os predicados sobre um conjunto que contém
// linhas de DOIS tenants e de DOIS alunos. Apagar um filtro no código de
// produção faz a linha estrangeira APARECER no retorno — a asserção é sobre o
// dado que volta, não sobre a chamada ter sido emitida. Pina a intenção (não
// vazar), não a implementação (chamar `.eq`).
//
// A FIXTURE É DELIBERADAMENTE ADVERSARIAL. A linha do outro tenant carrega o
// MESMO `student_id`, e a do outro aluno o MESMO `tenant_id`. Se cada linha
// estrangeira divergisse nos dois eixos ao mesmo tempo, o filtro sobrevivente
// engoliria a mutação do outro: apagar `.eq("tenant_id")` continuaria verde
// porque `.eq("student_id")` barraria a linha assim mesmo, e o teste provaria
// "existe ALGUM filtro", não "existem os DOIS". Cada linha estrangeira aqui é
// barrada por exatamente UM filtro, e é isso que faz cada mutação ter um
// vermelho só seu.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest"
import { bancoQueFiltra } from "../../__tests__/banco-que-filtra"
import type { ClienteLeitura } from "../fonte-supabase"
import { lerFonteAutogestao } from "../fonte-supabase"

const TENANT_MEU = "tenant-cliente-a"
const TENANT_OUTRO = "tenant-cliente-b"
const ALUNO_EU = "aluno-eu"
const ALUNO_OUTRO = "aluno-outro"
const CURSO = "curso-1"
const CURSO_OUTRO = "curso-2"

/** Carimbos distintos por linha: `slide_reflections` só seleciona `created_at`. */
const QUANDO_MINHA = "2026-08-01T10:00:00.000Z"
const QUANDO_DO_OUTRO_TENANT = "2026-08-02T10:00:00.000Z"
const QUANDO_DO_OUTRO_ALUNO = "2026-08-03T10:00:00.000Z"

function fixtura() {
  return bancoQueFiltra({
    sessions: [
      {
        id: "s-minha",
        tenant_id: TENANT_MEU,
        student_id: ALUNO_EU,
        chapter_id: "cap-1",
        status: "completed",
        created_at: QUANDO_MINHA,
        completed_at: QUANDO_MINHA,
        turn_number: 1,
        interactions_remaining: 0,
      },
      // Só `.eq("tenant_id", …)` (A1) barra esta: MESMO aluno, outro cliente.
      {
        id: "s-do-outro-tenant",
        tenant_id: TENANT_OUTRO,
        student_id: ALUNO_EU,
        chapter_id: "cap-1",
        status: "completed",
        created_at: QUANDO_DO_OUTRO_TENANT,
        completed_at: null,
        turn_number: 1,
        interactions_remaining: 0,
      },
      // Só `.eq("student_id", …)` (A2) barra esta: MESMO tenant, outro aluno.
      {
        id: "s-do-outro-aluno",
        tenant_id: TENANT_MEU,
        student_id: ALUNO_OUTRO,
        chapter_id: "cap-1",
        status: "completed",
        created_at: QUANDO_DO_OUTRO_ALUNO,
        completed_at: null,
        turn_number: 1,
        interactions_remaining: 0,
      },
    ],
    slide_reflections: [
      { tenant_id: TENANT_MEU, student_id: ALUNO_EU, created_at: QUANDO_MINHA },
      // Só o filtro de tenant (A3) barra esta.
      { tenant_id: TENANT_OUTRO, student_id: ALUNO_EU, created_at: QUANDO_DO_OUTRO_TENANT },
      { tenant_id: TENANT_MEU, student_id: ALUNO_OUTRO, created_at: QUANDO_DO_OUTRO_ALUNO },
    ],
    chapter_view_progress: [
      {
        tenant_id: TENANT_MEU,
        student_id: ALUNO_EU,
        chapter_id: "cap-1",
        max_slide_index: 3,
        slides_total_at_last_view: 10,
        reached_last_slide_at: null,
        first_viewed_at: QUANDO_MINHA,
        last_viewed_at: QUANDO_MINHA,
      },
      {
        tenant_id: TENANT_OUTRO,
        student_id: ALUNO_EU,
        chapter_id: "cap-do-outro-tenant",
        max_slide_index: 9,
        slides_total_at_last_view: 10,
        reached_last_slide_at: QUANDO_DO_OUTRO_TENANT,
        first_viewed_at: QUANDO_DO_OUTRO_TENANT,
        last_viewed_at: QUANDO_DO_OUTRO_TENANT,
      },
      {
        tenant_id: TENANT_MEU,
        student_id: ALUNO_OUTRO,
        chapter_id: "cap-do-outro-aluno",
        max_slide_index: 9,
        slides_total_at_last_view: 10,
        reached_last_slide_at: QUANDO_DO_OUTRO_ALUNO,
        first_viewed_at: QUANDO_DO_OUTRO_ALUNO,
        last_viewed_at: QUANDO_DO_OUTRO_ALUNO,
      },
    ],
    chapters: [
      { id: "modulo-meu", tenant_id: TENANT_MEU, course_id: CURSO, order: 1, title: "Módulo 1" },
      // Só o filtro de tenant (A4) barra esta: MESMO curso, outro cliente.
      {
        id: "modulo-do-outro-tenant",
        tenant_id: TENANT_OUTRO,
        course_id: CURSO,
        order: 2,
        title: "Módulo do outro cliente",
      },
      // Par contraditório do filtro vizinho (`course_id`), que não está sob mutação aqui.
      {
        id: "modulo-de-outro-curso",
        tenant_id: TENANT_MEU,
        course_id: CURSO_OUTRO,
        order: 3,
        title: "Módulo de outro curso",
      },
    ],
    study_plans: [
      // A linha ESTRANGEIRA vem primeiro de propósito: `.maybeSingle()` devolve
      // a primeira que sobrevive aos filtros, então uma ordem "amigável"
      // esconderia a remoção do filtro de tenant.
      {
        id: "plano-do-outro-tenant",
        tenant_id: TENANT_OUTRO,
        student_id: ALUNO_EU,
        course_id: CURSO,
        status: "active",
        module_durations: [],
        start_date: null,
        final_deadline_date: null,
        recalculated_at: null,
        baseline: null,
      },
      {
        id: "plano-meu",
        tenant_id: TENANT_MEU,
        student_id: ALUNO_EU,
        course_id: CURSO,
        status: "active",
        module_durations: [],
        start_date: null,
        final_deadline_date: null,
        recalculated_at: null,
        baseline: null,
      },
    ],
    tenants: [
      { id: TENANT_MEU, settings: {} },
      { id: TENANT_OUTRO, settings: { timezone_offset_minutes: 600 } },
    ],
  })
}

async function lerComoEu() {
  const { db } = fixtura()
  return await lerFonteAutogestao({
    db: db as unknown as ClienteLeitura,
    tenantId: TENANT_MEU,
    studentId: ALUNO_EU,
    courseId: CURSO,
    periodoDias: 30,
  })
}

describe("Autogestão — nenhum filtro de escopo pode ser apagado em silêncio", () => {
  /**
   * CONTROLE POSITIVO, e ele não é cerimônia: sem este caso, um duplo que
   * devolvesse `[]` para tudo (que é exatamente o duplo antigo) passaria em
   * todas as asserções de ausência abaixo. Um detector cego aprova o vazio.
   */
  it("controle positivo — o que É meu volta (senão as ausências abaixo não provam nada)", async () => {
    const fonte = await lerComoEu()
    expect(fonte.sessoes.map((s) => s.id)).toContain("s-minha")
    expect(fonte.reflexoes.map((r) => r.created_at)).toContain(QUANDO_MINHA)
    expect(fonte.capitulos.map((c) => c.id)).toContain("modulo-meu")
    expect(fonte.plano?.id).toBe("plano-meu")
  })

  // Cada caso abaixo assere UMA ausência, a que só o SEU filtro produz. Um
  // `toEqual(["s-minha"])` aqui seria mais curto e pior: os dois casos de
  // `sessions` morreriam juntos em qualquer das duas mutações, e o vermelho
  // deixaria de dizer QUAL filtro morreu. O fecho exaustivo existe, e está no
  // seu próprio caso, logo abaixo.

  it("A1 — `sessions` não traz sessão de OUTRO TENANT (mesmo com o mesmo student_id)", async () => {
    const fonte = await lerComoEu()
    expect(fonte.sessoes.map((s) => s.id)).not.toContain("s-do-outro-tenant")
  })

  it("A2 — `sessions` não traz sessão de OUTRO ALUNO (mesmo dentro do meu tenant)", async () => {
    const fonte = await lerComoEu()
    expect(fonte.sessoes.map((s) => s.id)).not.toContain("s-do-outro-aluno")
  })

  it("A3 — `slide_reflections` não traz reflexão de OUTRO TENANT (mesmo aluno)", async () => {
    const fonte = await lerComoEu()
    expect(fonte.reflexoes.map((r) => r.created_at)).not.toContain(QUANDO_DO_OUTRO_TENANT)
  })

  it("A4 — `chapters` não traz módulo de OUTRO TENANT (mesmo sob o MESMO course_id)", async () => {
    const fonte = await lerComoEu()
    expect(fonte.capitulos.map((c) => c.id)).not.toContain("modulo-do-outro-tenant")
  })

  /**
   * O FECHO EXAUSTIVO, separado de propósito: os casos acima nomeiam a linha
   * estrangeira que cada filtro barra; este diz que não existe uma quinta linha
   * chegando por um caminho que ninguém previu. Um `not.toContain` sozinho
   * aprovaria um vazamento de uma linha que a fixture não nomeia.
   */
  it("fecho — o retorno é EXATAMENTE o que é meu, em todas as quatro consultas", async () => {
    const fonte = await lerComoEu()
    expect(fonte.sessoes.map((s) => s.id)).toEqual(["s-minha"])
    expect(fonte.reflexoes.map((r) => r.created_at)).toEqual([QUANDO_MINHA])
    expect(fonte.capitulos.map((c) => c.id)).toEqual(["modulo-meu"])
    expect(fonte.progresso.map((p) => p.chapter_id)).toEqual(["cap-1"])
  })

  /**
   * Fora dos 7 do laudo, mesma classe de defeito: `chapter_view_progress` e
   * `study_plans` também só têm o `.eq()` da aplicação entre dois clientes.
   * Pinar aqui custa duas asserções e fecha o mesmo buraco antes que alguém o
   * encontre em produção.
   */
  it("extra — o plano individual também não atravessa a fronteira", async () => {
    const fonte = await lerComoEu()
    expect(fonte.plano?.id).not.toBe("plano-do-outro-tenant")
    expect(fonte.plano?.id).toBe("plano-meu")
  })

  /**
   * O outro lado do mesmo fato: lido COMO O OUTRO CLIENTE, o resultado é o
   * espelho. Um filtro escrito com o valor errado (constante fixa, id trocado)
   * passaria nos casos acima e cai aqui.
   */
  it("espelho — lendo como o outro cliente, só as linhas DELE voltam", async () => {
    const { db } = fixtura()
    const fonte = await lerFonteAutogestao({
      db: db as unknown as ClienteLeitura,
      tenantId: TENANT_OUTRO,
      studentId: ALUNO_EU,
      courseId: CURSO,
      periodoDias: 30,
    })
    expect(fonte.sessoes.map((s) => s.id)).toEqual(["s-do-outro-tenant"])
    expect(fonte.capitulos.map((c) => c.id)).toEqual(["modulo-do-outro-tenant"])
    expect(fonte.plano?.id).toBe("plano-do-outro-tenant")
  })
})
