// ---------------------------------------------------------------------------
// "Visão Geral" (autogestão) — um teste por regra inegociável do briefing.
// ---------------------------------------------------------------------------
// Os 4 obrigatórios do briefing, mais a inversão de controle (com plano NÃO
// mostra o CTA de criar plano) — o par que prova que o teste 2 mede o que diz
// medir, não uma renderização incondicional.
// ---------------------------------------------------------------------------

import {
  capitulo,
  fonteBase,
  haDias,
  moduloDuracao,
  plano,
  progresso,
  sessao,
} from "@/lib/analytics/autogestao/__tests__/fixture"
import { montarVisaoGeralAutogestao } from "@/lib/analytics/autogestao/montagem"
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { VisaoGeralAutogestaoTab } from "../visao-geral-tab"
import {
  blocoComoEstou,
  blocoComoEstouSemPlano,
  blocoRespostaSemAjuste,
  visaoGeralCompleta,
} from "./fixture"

afterEach(cleanup)

describe("§8/§31 — com plano e SEM plano nascem juntos, os dois com o mesmo capricho", () => {
  it("com plano: mostra ritmo, regularidade, progresso e última atividade — sem o CTA de criar plano", () => {
    render(<VisaoGeralAutogestaoTab dados={visaoGeralCompleta()} />)

    expect(screen.getByText("No ritmo")).toBeInTheDocument()
    expect(screen.getByText("1,8x por semana")).toBeInTheDocument()
    expect(screen.getByText("50%")).toBeInTheDocument()
    expect(screen.getByText("3 dias atrás")).toBeInTheDocument()

    // CONTROLE (par da asserção do teste seguinte): com plano de verdade
    // (`metaHoje` COM lastro), o callout "Criar meu plano" não aparece.
    expect(screen.queryByText("Criar meu plano")).not.toBeInTheDocument()
  })

  it("SEM plano: a tela cheia continua renderizando, mais o CTA 'Criar meu plano'", () => {
    render(
      <VisaoGeralAutogestaoTab
        dados={visaoGeralCompleta({ comoEstou: blocoComoEstouSemPlano() })}
      />,
    )

    // O mesmo capricho da tela cheia — regularidade e os demais blocos
    // continuam de pé, não uma tela vazia substituindo tudo. O tile Ritmo,
    // porém, NUNCA herda o rótulo calculado com plano ("No ritmo") — isso
    // seria afirmar conformidade a um plano que não existe (achado do
    // painel, 2026-08-22). "Sem referência" é o estado próprio, neutro.
    expect(screen.getByText("Sem referência")).toBeInTheDocument()
    expect(screen.queryByText("No ritmo")).not.toBeInTheDocument()
    expect(screen.getByText("25%")).toBeInTheDocument()
    expect(screen.getByText("Meu próximo movimento")).toBeInTheDocument()

    const cta = screen.getByRole("link", { name: "Criar meu plano" })
    expect(cta).toHaveAttribute("href", "/meu-plano")
  })

  it("plano com DURAÇÃO ZERADA (SEM LASTRO, mas TEM plano) não aciona o CTA de criar plano", () => {
    // Achado do dono: 4 de 5 planos reais têm `days: 0` — isso é "sem
    // lastro" por um motivo DIFERENTE de "sem plano" (`MOTIVO_PLANO_SEM_
    // DURACAO`), e não deve confundir o aluno pedindo para criar o que já
    // existe.
    render(
      <VisaoGeralAutogestaoTab
        dados={visaoGeralCompleta({
          comoEstou: blocoComoEstou({
            progresso: {
              percentual: 50,
              rotulo: "50%",
              metaHoje: {
                lastro: "ausente",
                motivo: "os módulos do seu plano ainda não têm duração definida",
              } as never,
              deltaPp: null,
              deltaRotulo: null,
            },
          }),
        })}
      />,
    )
    expect(screen.queryByText("Criar meu plano")).not.toBeInTheDocument()
  })
})

describe("Regra de lastro — 'Falta prova', nunca um número inventado", () => {
  it("1.3 (meta de regularidade) é SEM LASTRO sempre: renderiza 'Falta prova', nunca '0'", () => {
    render(<VisaoGeralAutogestaoTab dados={visaoGeralCompleta()} />)

    const tileRegularidade = screen.getByText("Regularidade").closest("div") as HTMLElement
    expect(tileRegularidade).not.toBeNull()
    expect(within(tileRegularidade).getByText(/Falta prova\./)).toBeInTheDocument()
    // A mutação-alvo (ver comando de verificação) troca este ramo por "0" —
    // esta asserção é o que morre quando isso acontece.
    expect(tileRegularidade.textContent).not.toMatch(/^Regularidade1,8x por semana0$/)
  })
})

describe("§12.1 — Meu próximo movimento é SEMPRE um só, mesmo com 2 gatilhos simultâneos", () => {
  it("sessão parada + atraso de plano ao mesmo tempo → só a de MAIOR prioridade renderiza", () => {
    const agora = new Date("2026-08-21T12:00:00.000Z")
    const capitulos = Array.from({ length: 8 }, (_, i) => capitulo(i + 1))
    const moduloAberto = capitulos[1] as { id: string; order: number; title: string }

    const fonte = fonteBase({
      capitulos,
      // Só 1 de 8 módulos concluído: progresso real ~13%, bem abaixo do
      // planejado (~50%) — dispara "atraso-de-plano".
      progresso: [
        progresso({
          chapter_id: capitulos[0]?.id as string,
          reached_last_slide_at: haDias(35),
        }),
      ],
      // Uma sessão iniciada há 3 dias e NUNCA concluída — dispara
      // "sessao-parada", que tem prioridade MAIOR (§12.1: sessão parada vem
      // antes de atraso de plano).
      sessoes: [
        sessao({
          chapter_id: moduloAberto.id,
          created_at: haDias(3),
          completed_at: null,
        }),
      ],
      plano: plano({
        startDateISO: haDias(40),
        moduleDurations: capitulos.map((c) => moduloDuracao(c.id, 10)), // 80 dias no total
      }),
    })

    const dados = montarVisaoGeralAutogestao(fonte, agora)
    expect(dados.estado).toBe("ok")
    // Prova, na camada de dados real (não na fixture de UI), que os DOIS
    // gatilhos realmente coexistem neste cenário — senão o teste provaria
    // só um caminho e chamaria de "dois gatilhos".
    expect(dados.comoEstou.conteudo?.ritmo.estado).toBe("abaixo-do-ritmo")

    render(<VisaoGeralAutogestaoTab dados={dados} />)

    // Uma ÚNICA seção "Meu próximo movimento", com o título da prioridade 1
    // (sessão parada), nunca dois cartões de recomendação.
    const titulosDeMovimento = screen.getAllByText(/^Retome ".+"$/)
    expect(titulosDeMovimento).toHaveLength(1)
    expect(screen.queryByText("Seu progresso está abaixo do previsto")).not.toBeInTheDocument()
  })
})

describe("Estados de bloco — vazio nunca vira zero renderizado", () => {
  it("sem ajuste registrado: mostra o texto vazio, nenhuma estatística inventada", () => {
    render(
      <VisaoGeralAutogestaoTab
        dados={visaoGeralCompleta({ respostaAosAjustes: blocoRespostaSemAjuste() })}
      />,
    )
    expect(screen.getByText("Você ainda não fez nenhum ajuste no seu plano.")).toBeInTheDocument()
    expect(screen.queryByText(/há 21 dias/)).not.toBeInTheDocument()
  })

  it("tela em erro de topo: nenhum número da Visão Geral é renderizado", () => {
    render(
      <VisaoGeralAutogestaoTab
        dados={{
          estado: "erro",
          erro: { codigo: "PGRST301", mensagem: "JWT expired" },
          comoEstou: {
            estado: "erro",
            erro: null,
            textoVazio: null,
            motivoVazio: null,
            conteudo: null,
          },
          sintese: { texto: "Não foi possível carregar este bloco agora.", tom: "neutral" },
          mudancas: { estado: "erro", erro: null, textoVazio: null, motivoVazio: null, itens: [] },
          atencao: { estado: "erro", erro: null, textoVazio: null, motivoVazio: null, itens: [] },
          proximoMovimento: {
            tipo: "manutencao-de-ritmo",
            titulo: "Você sustentou seu ritmo",
            texto: "Mantenha o padrão.",
            ctaPrincipal: "Ver meu plano",
            ctaSecundario: null,
          },
          respostaAosAjustes: {
            estado: "erro",
            erro: null,
            textoVazio: null,
            motivoVazio: null,
            conteudo: null,
          },
          sinaisDoMomento: {
            estado: "erro",
            erro: null,
            textoVazio: null,
            motivoVazio: null,
            itens: [],
          },
        }}
      />,
    )
    expect(screen.getByText("Não foi possível carregar esta tela agora")).toBeInTheDocument()
    expect(screen.queryByText("50%")).not.toBeInTheDocument()
  })
})
