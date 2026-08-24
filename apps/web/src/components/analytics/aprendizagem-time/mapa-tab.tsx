// ---------------------------------------------------------------------------
// TELA 3 — Mapa de Capacidades (§26-37 da spec). Referência visual:
// `tela-3-mapa-capacidades.png`.
// ---------------------------------------------------------------------------

import type { MapaCapacidadesDados } from "@/lib/analytics/aprendizagem-time/tipos"
import { BookOpen, ClipboardCheck, MessagesSquare, Search } from "lucide-react"
import {
  BarraPercent,
  Card,
  CardTitulo,
  CardTituloComInfo,
  CirculoIcone,
  CtaPilula,
  MioloCard,
  TEXTO,
  TOM_MATURIDADE,
} from "./design"

const RECUO_DA_COLUNA = "pr-[16px] pl-[31px] 2xl:pr-[56px]"

function TextoVazio({ texto }: { texto: string | null }) {
  return (
    <p className="text-[13px] leading-[18px]" style={{ color: TEXTO.terciario }}>
      {texto ?? "Sem dados para este recorte."}
    </p>
  )
}

const TAG_PRIORIDADE = {
  alta: { texto: "Alta", cor: "#1D9C6E", fundo: "#D8EDE3" },
  media: { texto: "Média", cor: "#E07104", fundo: "#FCE6CC" },
  baixa: { texto: "Baixa", cor: "#DE3B36", fundo: "#F9D6D6" },
} as const

function BlocoCapacidadesDoTime({
  capacidadesDoTime,
}: { capacidadesDoTime: MapaCapacidadesDados["capacidadesDoTime"] }) {
  return (
    <Card className="flex-1 p-[20px]">
      <CardTituloComInfo dica="Percentual de pessoas classificadas como Em desenvolvimento ou Demonstrada nesta capacidade.">
        Capacidades do time
      </CardTituloComInfo>
      <MioloCard
        centrado={capacidadesDoTime.estado !== "ok" || capacidadesDoTime.linhas.length === 0}
        className="mt-[14px]"
      >
        {capacidadesDoTime.estado === "ok" ? (
          capacidadesDoTime.linhas.length > 0 ? (
            <ul className="space-y-[14px]">
              {capacidadesDoTime.linhas.map((c) => {
                const tag = TAG_PRIORIDADE[c.prioridade]
                return (
                  <li key={c.capacidadeId}>
                    <div className="flex items-center justify-between gap-[10px]">
                      <span className="text-[13px]" style={{ color: TEXTO.secundario }}>
                        {c.titulo}
                      </span>
                      <span className="flex shrink-0 items-center gap-[10px]">
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: TEXTO.primario }}
                        >
                          {c.percentMaduro}%
                        </span>
                        <span
                          className="rounded-[6px] px-[8px] py-[2px] text-[11px] font-semibold"
                          style={{ color: tag.cor, backgroundColor: tag.fundo }}
                        >
                          {tag.texto}
                        </span>
                      </span>
                    </div>
                    <div className="mt-[6px]">
                      <BarraPercent
                        percent={c.percentMaduro}
                        tom={c.prioridade === "baixa" ? "amber" : "green"}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <TextoVazio texto="Nenhuma capacidade curada para este curso." />
          )
        ) : (
          <TextoVazio texto={capacidadesDoTime.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

function BlocoCapacidadeComMaiorGap({
  capacidadeComMaiorGap,
}: { capacidadeComMaiorGap: MapaCapacidadesDados["capacidadeComMaiorGap"] }) {
  const c = capacidadeComMaiorGap.estado === "ok" ? capacidadeComMaiorGap.capacidade : null
  return (
    <Card className="flex-1 p-[20px]">
      <CardTitulo>Capacidade com maior gap</CardTitulo>
      <MioloCard centrado={!c} className="mt-[14px]">
        {c ? (
          <div className="flex items-start gap-[12px]">
            <CirculoIcone tom="blue" diametro={40}>
              <Search size={18} strokeWidth={2.2} />
            </CirculoIcone>
            <div>
              <p className="text-[15px] font-bold" style={{ color: TEXTO.primario }}>
                {c.titulo}
              </p>
              <p
                className="mt-[4px] text-[12.5px] leading-[18px]"
                style={{ color: TEXTO.secundario }}
              >
                {c.texto}
              </p>
              <ul className="mt-[8px] space-y-[4px]">
                {c.sinais.map((s) => (
                  <li
                    key={s}
                    className="flex items-start gap-[6px] text-[12px] leading-[16px]"
                    style={{ color: TEXTO.terciario }}
                  >
                    <span className="mt-[6px] h-[4px] w-[4px] shrink-0 rounded-full bg-current" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <TextoVazio texto={capacidadeComMaiorGap.textoVazio ?? "Amostra ainda insuficiente."} />
        )}
      </MioloCard>
    </Card>
  )
}

function BlocoMapaCapacidadeEquipe({
  mapaCapacidadeEquipe,
}: { mapaCapacidadeEquipe: MapaCapacidadesDados["mapaCapacidadeEquipe"] }) {
  return (
    <Card className="p-[20px]">
      <CardTituloComInfo dica="Estado de maturidade corrente de cada pessoa em cada capacidade.">
        Mapa capacidade × equipe
      </CardTituloComInfo>
      <MioloCard
        centrado={mapaCapacidadeEquipe.estado !== "ok" || mapaCapacidadeEquipe.linhas.length === 0}
        className="mt-[14px]"
      >
        {mapaCapacidadeEquipe.estado === "ok" ? (
          mapaCapacidadeEquipe.linhas.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left" style={{ color: TEXTO.terciario }}>
                    <th className="pb-[10px] pr-[16px] font-medium">Pessoa</th>
                    {mapaCapacidadeEquipe.colunas.map((col) => (
                      <th
                        key={col.capacidadeId}
                        className="pb-[10px] pr-[10px] text-left font-medium"
                      >
                        {col.titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mapaCapacidadeEquipe.linhas.map((linha) => (
                    <tr key={linha.alunoId} className="border-t" style={{ borderColor: "#EDE9E6" }}>
                      <td
                        className="py-[10px] pr-[16px] font-semibold"
                        style={{ color: TEXTO.primario }}
                      >
                        {linha.nome}
                      </td>
                      {mapaCapacidadeEquipe.colunas.map((col) => {
                        const estado = linha.estados[col.capacidadeId]
                        const tom = TOM_MATURIDADE[estado]
                        return (
                          <td key={col.capacidadeId} className="py-[10px] pr-[10px]">
                            <span
                              className="inline-block rounded-[6px] px-[8px] py-[3px] text-[11px] font-semibold whitespace-nowrap"
                              style={{ color: tom.ink, backgroundColor: tom.fill }}
                            >
                              {tom.rotulo}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <TextoVazio texto="Nenhuma pessoa com dado suficiente neste período." />
          )
        ) : (
          <TextoVazio texto={mapaCapacidadeEquipe.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

function BlocoEvidenciasDisponiveis({
  evidenciasDisponiveis,
}: { evidenciasDisponiveis: MapaCapacidadesDados["evidenciasDisponiveis"] }) {
  const itens =
    evidenciasDisponiveis.estado === "ok"
      ? [
          {
            Icone: MessagesSquare,
            valor: evidenciasDisponiveis.reflexoesAnalisadas,
            rotulo: "Reflexões analisadas",
            descricao: "Registros de aprendizados e análises individuais",
          },
          {
            Icone: BookOpen,
            valor: evidenciasDisponiveis.casosPraticos,
            rotulo: "Casos práticos",
            descricao: "Aplicação do conceito em casos",
          },
          {
            Icone: ClipboardCheck,
            valor: evidenciasDisponiveis.validacoesGestor,
            rotulo: "Validações do gestor",
            descricao: "Feedbacks e validações registradas",
          },
        ]
      : []
  return (
    <Card className="flex-1 p-[20px]">
      <CardTituloComInfo dica="Capacidade demonstrada exige combinação de diferentes tipos de evidência.">
        Evidências disponíveis
      </CardTituloComInfo>
      <MioloCard centrado={evidenciasDisponiveis.estado !== "ok"} className="mt-[14px]">
        {evidenciasDisponiveis.estado === "ok" ? (
          <div className="flex gap-[12px]">
            {itens.map((item) => (
              <div
                key={item.rotulo}
                className="flex-1 rounded-[10px] p-[14px]"
                style={{ backgroundColor: "#FAF8F7" }}
              >
                <CirculoIcone tom="neutral" diametro={26}>
                  <item.Icone size={13} strokeWidth={2.2} />
                </CirculoIcone>
                <p className="mt-[8px] text-[20px] font-bold" style={{ color: TEXTO.primario }}>
                  {item.valor}
                </p>
                <p className="text-[12px] font-semibold" style={{ color: TEXTO.secundario }}>
                  {item.rotulo}
                </p>
                <p
                  className="mt-[2px] text-[11px] leading-[14px]"
                  style={{ color: TEXTO.terciario }}
                >
                  {item.descricao}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <TextoVazio texto={evidenciasDisponiveis.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

function BlocoPessoasApoio({
  pessoasApoio,
}: { pessoasApoio: MapaCapacidadesDados["pessoasApoio"] }) {
  return (
    <Card className="flex-1 p-[20px]">
      <CardTitulo>
        Pessoas que precisam de apoio
        {pessoasApoio.estado === "ok" && pessoasApoio.capacidadeGapTitulo && (
          <span className="ml-[8px] text-[12px] font-normal" style={{ color: TEXTO.terciario }}>
            (gap: {pessoasApoio.capacidadeGapTitulo})
          </span>
        )}
      </CardTitulo>
      <MioloCard
        centrado={pessoasApoio.estado !== "ok" || pessoasApoio.linhas.length === 0}
        className="mt-[12px]"
      >
        {pessoasApoio.estado === "ok" ? (
          pessoasApoio.linhas.length > 0 ? (
            <>
              <ul className="space-y-[10px]">
                {pessoasApoio.linhas.map((p) => {
                  const tom = TOM_MATURIDADE[p.estado]
                  return (
                    <li key={p.alunoId} className="flex items-center justify-between gap-[8px]">
                      <span className="flex items-center gap-[8px]">
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: TEXTO.primario }}
                        >
                          {p.nome}
                        </span>
                        <span
                          className="rounded-[6px] px-[6px] py-[1px] text-[10.5px] font-semibold"
                          style={{ color: tom.ink, backgroundColor: tom.fill }}
                        >
                          {tom.rotulo}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px]" style={{ color: TEXTO.terciario }}>
                        {p.necessidade}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-[12px]">
                <CtaPilula rotulo="Ver pessoas" className="px-[12px] py-[7px]" />
              </div>
            </>
          ) : (
            <TextoVazio texto="Ninguém precisa de apoio direcionado nesta capacidade agora." />
          )
        ) : (
          <TextoVazio texto={pessoasApoio.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

function BlocoIntervencoes({
  recomendacoes,
}: { recomendacoes: MapaCapacidadesDados["recomendacoes"] }) {
  return (
    <Card className="flex-1 p-[20px]">
      <CardTitulo>Recomendações de intervenção</CardTitulo>
      <MioloCard
        centrado={recomendacoes.estado !== "ok" || recomendacoes.itens.length === 0}
        className="mt-[12px]"
      >
        {recomendacoes.estado === "ok" ? (
          recomendacoes.itens.length > 0 ? (
            <ul className="space-y-[12px]">
              {recomendacoes.itens.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-[10px]">
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: TEXTO.primario }}>
                      {r.titulo}
                    </p>
                    <p className="text-[12px] leading-[16px]" style={{ color: TEXTO.terciario }}>
                      {r.contexto}
                    </p>
                  </div>
                  <CtaPilula rotulo={r.cta} className="shrink-0 px-[12px] py-[7px]" />
                </li>
              ))}
            </ul>
          ) : (
            <TextoVazio texto="Nenhuma intervenção sugerida agora." />
          )
        ) : (
          <TextoVazio texto={recomendacoes.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

export function MapaCapacidadesTab({ data }: { data: MapaCapacidadesDados }) {
  if (data.estado === "erro") {
    return (
      <div className={`${RECUO_DA_COLUNA} py-[24px]`}>
        <Card className="max-w-[640px] p-[20px]">
          <p className="text-[14px] font-semibold" style={{ color: TEXTO.primario }}>
            Não foi possível carregar o Mapa de Capacidades
          </p>
          <p className="mt-[6px] text-[13px]" style={{ color: TEXTO.terciario }}>
            {data.erro?.mensagem ?? "Falha de leitura."}
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className={`${RECUO_DA_COLUNA} flex flex-col gap-[14px] py-[8px]`}>
      <div className="flex gap-[14px]">
        <BlocoCapacidadesDoTime capacidadesDoTime={data.capacidadesDoTime} />
        <BlocoCapacidadeComMaiorGap capacidadeComMaiorGap={data.capacidadeComMaiorGap} />
      </div>
      <BlocoMapaCapacidadeEquipe mapaCapacidadeEquipe={data.mapaCapacidadeEquipe} />
      <div className="flex gap-[14px]">
        <BlocoEvidenciasDisponiveis evidenciasDisponiveis={data.evidenciasDisponiveis} />
        <BlocoPessoasApoio pessoasApoio={data.pessoasApoio} />
        <BlocoIntervencoes recomendacoes={data.recomendacoes} />
      </div>
    </div>
  )
}
