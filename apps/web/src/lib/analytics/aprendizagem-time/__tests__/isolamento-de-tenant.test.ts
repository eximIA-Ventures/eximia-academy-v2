// ---------------------------------------------------------------------------
// A5-A7 — os filtros de tenant de Aprendizagem do Time, pinados por VAZAMENTO.
// ---------------------------------------------------------------------------
// O DEFEITO QUE ISTO ARRANCA (laudo LOOP-2, Eixo A): `fonte-supabase.ts` desta
// frente tinha COBERTURA ZERO. O canário do laudo (`throw` na entrada de
// `lerFonteAprendizagem`) ficou MUDO: a função não executava em teste algum.
// A5-A7 não eram "asserção fraca" — eram um arquivo inteiro que nenhum teste
// alcançava. Este arquivo é a primeira vez que esta camada roda sob teste.
//
// POR QUE ISSO É CRÍTICO: o client é o de SERVIÇO (`ClienteLeitura =
// ReturnType<typeof createServiceClient>`) e, no próprio comentário de
// `_trinca/recorte.ts`, "RLS bloqueia o gestor por desenho". Ou seja, a RLS do
// banco não protege este caminho — ela é contornada de propósito. O
// `.eq("tenant_id", …)` da aplicação é a ÚNICA fronteira entre dois clientes
// pagantes, e o que vaza aqui são NOMES DE PESSOAS (`users.full_name`) e a
// avaliação de capacidade de cada uma. Incidente cross-tenant real nesta casa:
// 18/08/2026.
//
// COMO ISTO MEDE: o duplo `banco-que-filtra.ts` APLICA os predicados sobre um
// conjunto com linhas de dois tenants. A asserção é sobre o dado que volta —
// apagar um `.eq()` faz a linha do outro cliente APARECER. Não é spy de
// chamada, não é `grep`: pina a intenção (não vazar), não a implementação.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest"
import { bancoQueFiltra } from "../../__tests__/banco-que-filtra"
import type { ClienteLeitura, ParametrosLeitura } from "../fonte-supabase"
import { lerFonteAprendizagem } from "../fonte-supabase"

const TENANT_MEU = "tenant-cliente-a"
const TENANT_OUTRO = "tenant-cliente-b"
const CURSO = "curso-1"
const CAP_MINHA = "cap-minha"
const CAP_DO_OUTRO = "cap-do-outro-cliente"
const AGORA = Date.parse("2026-08-28T12:00:00.000Z")
const QUANDO = "2026-08-01T10:00:00.000Z"

function fixtura() {
  return bancoQueFiltra({
    capabilities: [
      {
        id: CAP_MINHA,
        tenant_id: TENANT_MEU,
        course_id: CURSO,
        title: "Negociação",
        slug: "negociacao",
        is_active: true,
        display_order: 1,
      },
      // Só `.eq("tenant_id", p.tenantId)` (A5) barra esta.
      {
        id: CAP_DO_OUTRO,
        tenant_id: TENANT_OUTRO,
        course_id: CURSO,
        title: "Capacidade do outro cliente",
        slug: "outro",
        is_active: true,
        display_order: 2,
      },
      // Par contraditório do filtro vizinho (`is_active`), que não está sob mutação aqui.
      {
        id: "cap-arquivada",
        tenant_id: TENANT_MEU,
        course_id: CURSO,
        title: "Arquivada",
        slug: "arquivada",
        is_active: false,
        display_order: 3,
      },
    ],
    capability_assessments: [
      {
        tenant_id: TENANT_MEU,
        student_id: "aluno-meu",
        capability_id: CAP_MINHA,
        new_state: "developing",
        is_current: true,
        created_at: QUANDO,
      },
      // ADVERSARIAL DE PROPÓSITO: esta linha aponta para a MINHA capacidade.
      // Se ela apontasse para `CAP_DO_OUTRO`, o `.in("capability_id",
      // capacidadeIds)` a barraria sozinho, e apagar o filtro de tenant
      // continuaria verde — o teste provaria "existe ALGUM filtro", não que o
      // filtro de tenant carrega o próprio peso. É a camada redundante
      // engolindo a mutação, e é exatamente o que se quer evitar aqui.
      {
        tenant_id: TENANT_OUTRO,
        student_id: "aluno-do-outro-cliente",
        capability_id: CAP_MINHA,
        new_state: "demonstrated",
        is_current: true,
        created_at: QUANDO,
      },
    ],
    capability_evidence: [
      {
        tenant_id: TENANT_MEU,
        student_id: "aluno-meu",
        capability_id: CAP_MINHA,
        concept_id: null,
        evidence_category: "cognitive",
        comprehension: "evidenced",
        depth_level: 2,
        application_level: null,
        occurred_at: QUANDO,
      },
      {
        tenant_id: TENANT_OUTRO,
        student_id: "aluno-do-outro-cliente",
        capability_id: CAP_MINHA,
        concept_id: null,
        evidence_category: "cognitive",
        comprehension: "evidenced",
        depth_level: 3,
        application_level: null,
        occurred_at: QUANDO,
      },
    ],
    concepts: [
      {
        id: "conceito-meu",
        tenant_id: TENANT_MEU,
        course_id: CURSO,
        title: "Conceito 1",
        is_active: true,
        display_order: 1,
      },
      {
        id: "conceito-do-outro",
        tenant_id: TENANT_OUTRO,
        course_id: CURSO,
        title: "Conceito do outro cliente",
        is_active: true,
        display_order: 2,
      },
    ],
    users: [
      {
        id: "aluno-meu",
        tenant_id: TENANT_MEU,
        full_name: "Pessoa do cliente A",
        report_name: null,
        role: "student",
        deleted_at: null,
      },
      // Só `.eq("tenant_id", p.tenantId)` (A7) barra esta — mesmo papel, não deletada.
      {
        id: "aluno-do-outro-cliente",
        tenant_id: TENANT_OUTRO,
        full_name: "Pessoa do cliente B",
        report_name: null,
        role: "student",
        deleted_at: null,
      },
      // Pares contraditórios dos filtros vizinhos, que não estão sob mutação aqui.
      {
        id: "aluno-deletado",
        tenant_id: TENANT_MEU,
        full_name: "Removida",
        report_name: null,
        role: "student",
        deleted_at: QUANDO,
      },
      {
        id: "gestor-meu",
        tenant_id: TENANT_MEU,
        full_name: "Gestora",
        report_name: null,
        role: "manager",
        deleted_at: null,
      },
    ],
  })
}

async function lerComoCliente(tenantId: string, cursoId: string | null = null) {
  const { db } = fixtura()
  const p: ParametrosLeitura = {
    db: db as unknown as ClienteLeitura,
    tenantId,
    escopoAlunoIds: null,
    cursoId,
    agoraMs: AGORA,
    periodoDias: 30,
  }
  return await lerFonteAprendizagem(p)
}

describe("Aprendizagem do Time — nenhum filtro de tenant pode ser apagado em silêncio", () => {
  /**
   * CONTROLE POSITIVO. Sem ele, um duplo que devolvesse `[]` para tudo passaria
   * em todas as ausências abaixo — e é justamente esse o duplo que deixou este
   * arquivo com cobertura zero por uma onda inteira. Detector cego aprova o
   * vazio.
   *
   * Vale outra função aqui: `lerFonteAprendizagem` tem uma SAÍDA ANTECIPADA
   * quando não há capacidade nenhuma (devolve tudo vazio). Se este caso não
   * existisse, todos os demais poderiam estar medindo o retorno curto, sem
   * jamais ter chegado às três consultas seguintes.
   */
  it("controle positivo — o que É meu volta, e o caminho longo foi de fato percorrido", async () => {
    const fonte = await lerComoCliente(TENANT_MEU)
    expect(fonte.capacidades.map((c) => c.id)).toContain(CAP_MINHA)
    expect(fonte.avaliacoes.map((a) => a.studentId)).toContain("aluno-meu")
    expect(fonte.evidencias.map((e) => e.studentId)).toContain("aluno-meu")
    expect(fonte.alunos.map((a) => a.id)).toContain("aluno-meu")
  })

  it("A5 — `capabilities` não traz capacidade de OUTRO TENANT", async () => {
    const fonte = await lerComoCliente(TENANT_MEU)
    expect(fonte.capacidades.map((c) => c.id)).not.toContain(CAP_DO_OUTRO)
  })

  it("A6 — `capability_assessments` não traz avaliação de OUTRO TENANT (mesma capability_id)", async () => {
    const fonte = await lerComoCliente(TENANT_MEU)
    expect(fonte.avaliacoes.map((a) => a.studentId)).not.toContain("aluno-do-outro-cliente")
  })

  it("A7 — `users` não traz PESSOA de OUTRO TENANT (mesmo papel, não deletada)", async () => {
    const fonte = await lerComoCliente(TENANT_MEU)
    const nomes = fonte.alunos.map((a) => a.nome)
    expect(fonte.alunos.map((a) => a.id)).not.toContain("aluno-do-outro-cliente")
    // O que vaza aqui é NOME DE PESSOA de outro cliente pagante, não um id opaco.
    expect(nomes).not.toContain("Pessoa do cliente B")
  })

  /**
   * Fora dos 7 do laudo, mesma classe e mesma consequência: `capability_evidence`
   * e `concepts` também têm só o `.eq()` da aplicação entre dois clientes.
   */
  it("extra — evidências e conceitos também não atravessam a fronteira", async () => {
    const fonte = await lerComoCliente(TENANT_MEU, CURSO)
    expect(fonte.evidencias.map((e) => e.studentId)).not.toContain("aluno-do-outro-cliente")
    expect(fonte.conceitos.map((c) => c.id)).not.toContain("conceito-do-outro")
    expect(fonte.conceitos.map((c) => c.id)).toEqual(["conceito-meu"])
  })

  /**
   * O FECHO EXAUSTIVO: os casos acima nomeiam a linha estrangeira que cada
   * filtro barra; este diz que não chegou uma quinta linha por um caminho que a
   * fixture não previu.
   */
  it("fecho — o retorno é EXATAMENTE o do meu tenant, nas quatro consultas", async () => {
    const fonte = await lerComoCliente(TENANT_MEU)
    expect(fonte.capacidades.map((c) => c.id)).toEqual([CAP_MINHA])
    expect(fonte.avaliacoes.map((a) => a.studentId)).toEqual(["aluno-meu"])
    expect(fonte.evidencias.map((e) => e.studentId)).toEqual(["aluno-meu"])
    expect(fonte.alunos.map((a) => a.id)).toEqual(["aluno-meu"])
  })

  /**
   * O outro lado do mesmo fato. Um filtro escrito com o valor errado (constante
   * fixa, id trocado) passaria em tudo acima e cai aqui.
   */
  it("espelho — lendo como o outro cliente, só as linhas DELE voltam", async () => {
    const fonte = await lerComoCliente(TENANT_OUTRO)
    expect(fonte.capacidades.map((c) => c.id)).toEqual([CAP_DO_OUTRO])
    // A avaliação do outro cliente aponta para a MINHA capacidade; com o escopo
    // dele, `capacidadeIds` é `[CAP_DO_OUTRO]`, e nada casa. Vazio honesto.
    expect(fonte.avaliacoes).toEqual([])
    expect(fonte.alunos.map((a) => a.id)).toEqual(["aluno-do-outro-cliente"])
  })
})
