// ---------------------------------------------------------------------------
// TELA 2 — Padrões e Evolução (§17-25 da spec). Mesma anatomia da Tela 1:
// reusa Card/CardTitulo/CardTituloComInfo/MioloCard/CirculoIcone/CtaPilula/
// LinkRodape/BarraPercent de `./design`. Referência visual: `tela-2-padroes-
// evolucao.png`.
// ---------------------------------------------------------------------------

import type { PadroesEvolucaoDados } from "@/lib/analytics/aprendizagem-time/tipos"
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react"
import {
  BarraPercent,
  Card,
  CardTitulo,
  CardTituloComInfo,
  CirculoIcone,
  CtaPilula,
  LinkRodape,
  MioloCard,
  TEXTO,
} from "./design"
import { CardFalhaDeLeitura } from "./falha-de-leitura"
import { GraficoProfundidade } from "./grafico-profundidade"

const RECUO_DA_COLUNA = "pr-[16px] pl-[31px] 2xl:pr-[56px]"

function TextoVazio({ texto }: { texto: string | null }) {
  return (
    <p className="text-[13px] leading-[18px]" style={{ color: TEXTO.terciario }}>
      {texto ?? "Sem dados para este recorte."}
    </p>
  )
}

const TOM_SINAL = { positivo: "green", negativo: "red", neutro: "neutral" } as const

function BlocoEvolucao({
  evolucaoProfundidade,
}: { evolucaoProfundidade: PadroesEvolucaoDados["evolucaoProfundidade"] }) {
  return (
    <Card className="flex-[2] p-[20px]">
      <div className="flex items-start justify-between gap-[16px]">
        <CardTituloComInfo dica="Percentual de evidências em nível de profundidade alto (4+) e com aplicação contextualizada, por semana.">
          Evolução da profundidade
        </CardTituloComInfo>
      </div>
      <MioloCard centrado={evolucaoProfundidade.estado !== "ok"} className="mt-[8px]">
        {evolucaoProfundidade.estado === "ok" ? (
          <>
            <GraficoProfundidade pontos={evolucaoProfundidade.pontos} />
            {evolucaoProfundidade.insight && (
              <p
                className="mt-[10px] flex items-start gap-[8px] text-[12.5px] leading-[18px]"
                style={{ color: TEXTO.secundario }}
              >
                <ArrowRight size={14} strokeWidth={2.4} className="mt-[2px] shrink-0" />
                {evolucaoProfundidade.insight}
              </p>
            )}
          </>
        ) : (
          <TextoVazio texto={evolucaoProfundidade.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

function BlocoPadroesEmergentes({
  padroesEmergentes,
}: { padroesEmergentes: PadroesEvolucaoDados["padroesEmergentes"] }) {
  return (
    <Card className="flex-1 p-[20px]">
      <CardTitulo>Padrões emergentes</CardTitulo>
      <MioloCard
        centrado={padroesEmergentes.estado !== "ok" || padroesEmergentes.sinais.length === 0}
        className="mt-[12px]"
      >
        {padroesEmergentes.estado === "ok" ? (
          padroesEmergentes.sinais.length > 0 ? (
            <ul className="space-y-[12px]">
              {padroesEmergentes.sinais.map((s) => (
                <li key={s.id} className="flex items-start gap-[8px]">
                  <CirculoIcone tom={TOM_SINAL[s.tom]} diametro={20}>
                    <Sparkles size={11} strokeWidth={2.4} />
                  </CirculoIcone>
                  <div>
                    <p
                      className="text-[13px] leading-[18px] font-semibold"
                      style={{ color: TEXTO.primario }}
                    >
                      {s.titulo}
                    </p>
                    <p className="text-[12px] leading-[16px]" style={{ color: TEXTO.terciario }}>
                      {s.texto}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <TextoVazio texto="Nenhum padrão relevante identificado neste período." />
          )
        ) : (
          <TextoVazio texto={padroesEmergentes.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

function BlocoOndeTrava({ ondeTrava }: { ondeTrava: PadroesEvolucaoDados["ondeTrava"] }) {
  return (
    <Card className="flex-[2] p-[20px]">
      <CardTitulo>Onde a aprendizagem trava</CardTitulo>
      <MioloCard
        centrado={ondeTrava.estado !== "ok" || ondeTrava.linhas.length === 0}
        className="mt-[12px]"
      >
        {ondeTrava.estado === "ok" ? (
          ondeTrava.linhas.length > 0 ? (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left" style={{ color: TEXTO.terciario }}>
                  <th className="pb-[8px] font-medium">Módulo</th>
                  <th className="pb-[8px] pr-[12px] text-right font-medium">Compreensão</th>
                  <th className="pb-[8px] pr-[12px] text-right font-medium">Aplicação</th>
                  <th className="pb-[8px] text-right font-medium">Gap principal</th>
                </tr>
              </thead>
              <tbody>
                {ondeTrava.linhas.map((l) => (
                  <tr key={l.conceitoId} className="border-t" style={{ borderColor: "#EDE9E6" }}>
                    <td className="py-[8px] font-semibold" style={{ color: TEXTO.primario }}>
                      {l.modulo}
                    </td>
                    <td
                      className="py-[8px] pr-[12px] text-right"
                      style={{ color: TEXTO.secundario }}
                    >
                      {l.compreensaoPercent === null ? "—" : `${l.compreensaoPercent}%`}
                    </td>
                    <td
                      className="py-[8px] pr-[12px] text-right"
                      style={{ color: TEXTO.secundario }}
                    >
                      {l.aplicacaoPercent === null ? "—" : `${l.aplicacaoPercent}%`}
                    </td>
                    <td className="py-[8px] text-right" style={{ color: TEXTO.secundario }}>
                      {l.gapPrincipal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <TextoVazio texto="Nenhum módulo com amostra suficiente neste período." />
          )
        ) : (
          <TextoVazio texto={ondeTrava.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

function BlocoConceitosFrageis({
  conceitosFrageis,
}: { conceitosFrageis: PadroesEvolucaoDados["conceitosFrageis"] }) {
  return (
    <Card className="flex-1 p-[20px]">
      <CardTitulo>Conceitos frágeis</CardTitulo>
      <MioloCard
        centrado={conceitosFrageis.estado !== "ok" || conceitosFrageis.linhas.length === 0}
        className="mt-[12px]"
      >
        {conceitosFrageis.estado === "ok" ? (
          conceitosFrageis.linhas.length > 0 ? (
            <ul className="space-y-[10px]">
              {conceitosFrageis.linhas.map((c) => (
                <li key={c.conceitoId} className="flex items-center justify-between gap-[8px]">
                  <span
                    className="flex items-center gap-[8px] text-[13px]"
                    style={{ color: TEXTO.secundario }}
                  >
                    <CirculoIcone tom="amber" diametro={18}>
                      <AlertTriangle size={10} strokeWidth={2.4} />
                    </CirculoIcone>
                    {c.titulo}
                  </span>
                  <span className="shrink-0 text-[12.5px]" style={{ color: TEXTO.terciario }}>
                    {c.pessoasAfetadas} pessoas · {c.percentAfetado}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <TextoVazio texto="Nenhum conceito frágil identificado neste período." />
          )
        ) : (
          <TextoVazio texto={conceitosFrageis.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

function BlocoModulosEvolucao({
  modulosEvolucao,
}: { modulosEvolucao: PadroesEvolucaoDados["modulosEvolucao"] }) {
  return (
    <Card className="flex-1 p-[20px]">
      <CardTitulo>Módulos com maior evolução</CardTitulo>
      <MioloCard
        centrado={modulosEvolucao.estado !== "ok" || modulosEvolucao.linhas.length === 0}
        className="mt-[12px]"
      >
        {modulosEvolucao.estado === "ok" ? (
          modulosEvolucao.linhas.length > 0 ? (
            <ul className="space-y-[12px]">
              {(() => {
                const maiorDelta = Math.max(...modulosEvolucao.linhas.map((m) => m.deltaPp))
                return modulosEvolucao.linhas.map((m) => (
                  <li key={m.conceitoId}>
                    <div className="flex items-center justify-between gap-[8px]">
                      <span className="text-[13px]" style={{ color: TEXTO.secundario }}>
                        {m.titulo}
                      </span>
                      <span className="text-[12px] font-semibold" style={{ color: "#2E9E6B" }}>
                        ↑ {m.deltaPp} p.p.
                      </span>
                    </div>
                    <div className="mt-[6px]">
                      {/* Proporção RELATIVA ao maior delta da lista, não percentual absoluto —
                          `deltaPp` é uma variação em pontos percentuais, não um valor 0-100. */}
                      <BarraPercent percent={(m.deltaPp / maiorDelta) * 100} tom="green" />
                    </div>
                  </li>
                ))
              })()}
            </ul>
          ) : (
            <TextoVazio texto="Nenhuma evolução relevante neste período." />
          )
        ) : (
          <TextoVazio texto={modulosEvolucao.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

function BlocoRecomendacoesPadroes({
  recomendacoes,
}: { recomendacoes: PadroesEvolucaoDados["recomendacoes"] }) {
  const temConteudo = recomendacoes.estado === "ok" && recomendacoes.itens.length > 0
  return (
    <Card className="relative flex-1 p-[20px]">
      <CardTitulo>O que fazer agora</CardTitulo>
      <MioloCard
        centrado={recomendacoes.estado !== "ok" || recomendacoes.itens.length === 0}
        className="mt-[12px]"
      >
        {recomendacoes.estado === "ok" ? (
          recomendacoes.itens.length > 0 ? (
            <ol className="space-y-[12px]">
              {recomendacoes.itens.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-[10px]">
                  <div>
                    <p
                      className="text-[13px] leading-[18px] font-semibold"
                      style={{ color: TEXTO.primario }}
                    >
                      {r.prioridade}. {r.titulo}
                    </p>
                    <p className="text-[12.5px] leading-[17px]" style={{ color: TEXTO.terciario }}>
                      {r.contexto}
                    </p>
                  </div>
                  <CtaPilula rotulo={r.cta} className="shrink-0 px-[12px] py-[7px]" />
                </li>
              ))}
            </ol>
          ) : (
            <TextoVazio texto="Nada exige ação agora." />
          )
        ) : (
          <TextoVazio texto={recomendacoes.textoVazio} />
        )}
      </MioloCard>
      {temConteudo && <LinkRodape rotulo="Ver módulo" />}
    </Card>
  )
}

export function PadroesEvolucaoTab({ data }: { data: PadroesEvolucaoDados }) {
  if (data.estado === "erro") {
    return (
      <div className={`${RECUO_DA_COLUNA} py-[24px]`}>
        <CardFalhaDeLeitura
          titulo="Não foi possível carregar Padrões e Evolução"
          falha={data.erro}
        />
      </div>
    )
  }

  return (
    <div className={`${RECUO_DA_COLUNA} flex flex-col gap-[14px] py-[8px]`}>
      <div className="flex gap-[14px]">
        <BlocoEvolucao evolucaoProfundidade={data.evolucaoProfundidade} />
        <BlocoPadroesEmergentes padroesEmergentes={data.padroesEmergentes} />
      </div>
      <BlocoOndeTrava ondeTrava={data.ondeTrava} />
      <div className="flex gap-[14px]">
        <BlocoConceitosFrageis conceitosFrageis={data.conceitosFrageis} />
        <BlocoModulosEvolucao modulosEvolucao={data.modulosEvolucao} />
        <BlocoRecomendacoesPadroes recomendacoes={data.recomendacoes} />
      </div>
    </div>
  )
}
