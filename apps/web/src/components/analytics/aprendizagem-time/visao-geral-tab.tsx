// ---------------------------------------------------------------------------
// TELA 1 — Visão Geral de Aprendizagem do Time (§8-§16 da spec).
//
// Reusa Card/CardTitulo/MioloCard/CirculoIcone/TEXTO/TOM_ICONE de Ativação —
// mesmo produto, mesmo vocabulário visual — sem pixel-lock (não há PNG de
// referência pra esta tela, só os 3 screenshots conceituais que orientaram
// a hierarquia de blocos abaixo). Nenhum dado de Ativação (sessão, acesso,
// progresso) aparece aqui — Regra 3 da spec: atividade não é aprendizagem.
// ---------------------------------------------------------------------------

import type { VisaoGeralAprendizagemDados } from "@/lib/analytics/aprendizagem-time/tipos"
import { Brain, Layers, Target, TrendingUp } from "lucide-react"
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

/** §9 — um ícone por dimensão do placar, tom semântico (referência: tela-1-visao-geral.png). */
const ICONE_PLACAR = {
  compreensao: { Icone: Brain, tom: "green" as const },
  profundidade: { Icone: Layers, tom: "amber" as const },
  aplicacao: { Icone: Target, tom: "blue" as const },
  evolucao: { Icone: TrendingUp, tom: "green" as const },
}

const RECUO_DA_COLUNA = "pr-[16px] pl-[31px] 2xl:pr-[56px]"

function TextoVazio({ texto }: { texto: string | null }) {
  return (
    <p className="text-[13px] leading-[18px]" style={{ color: TEXTO.terciario }}>
      {texto ?? "Sem dados para este recorte."}
    </p>
  )
}

function IndicadorPlacar({
  chave,
  rotulo,
  valorPercent,
  deltaPp,
  descricao,
}: {
  chave: keyof typeof ICONE_PLACAR
  rotulo: string
  valorPercent: number | null
  deltaPp: number | null
  descricao: string
}) {
  const { Icone, tom } = ICONE_PLACAR[chave]
  return (
    <div className="flex-1 rounded-[10px] p-[16px]" style={{ backgroundColor: "#FAF8F7" }}>
      <div className="flex items-center gap-[8px]">
        <CirculoIcone tom={tom} diametro={26}>
          <Icone size={14} strokeWidth={2.2} />
        </CirculoIcone>
        <p className="text-[12px] leading-[16px] font-semibold" style={{ color: TEXTO.secundario }}>
          {rotulo}
        </p>
      </div>
      <p
        className="mt-[8px] text-[25px] leading-[30px] font-bold"
        style={{ color: TEXTO.primario }}
      >
        {valorPercent === null ? "—" : `${valorPercent}%`}
      </p>
      <p className="mt-[2px] text-[12px] leading-[16px]" style={{ color: TEXTO.terciario }}>
        {descricao}
      </p>
      {deltaPp !== null && (
        <p
          className="mt-[6px] text-[12px] leading-[16px] font-semibold"
          style={{ color: deltaPp >= 0 ? "#2E9E6B" : "#DE3B36" }}
        >
          {deltaPp >= 0 ? "↑" : "↓"} {Math.abs(deltaPp)} p.p.
        </p>
      )}
    </div>
  )
}

function BlocoPlacar({ placar }: { placar: VisaoGeralAprendizagemDados["placar"] }) {
  return (
    <Card className="flex-[1.8] p-[20px]">
      <CardTituloComInfo dica="Como o time está compreendendo, aprofundando e aplicando o que aprendeu, no período selecionado.">
        Placar da aprendizagem
      </CardTituloComInfo>
      <MioloCard centrado={placar.estado !== "ok"} className="mt-[14px]">
        {placar.estado === "ok" ? (
          <div className="flex gap-[12px]">
            <IndicadorPlacar
              chave="compreensao"
              rotulo="Compreensão"
              valorPercent={placar.compreensao.valorPercent}
              deltaPp={placar.compreensao.deltaPp}
              descricao="Entendimento dos conceitos-chave"
            />
            <IndicadorPlacar
              chave="profundidade"
              rotulo="Profundidade"
              valorPercent={placar.profundidade.valorPercent}
              deltaPp={placar.profundidade.deltaPp}
              descricao="Exploração e conexão entre conceitos"
            />
            <IndicadorPlacar
              chave="aplicacao"
              rotulo="Aplicação"
              valorPercent={placar.aplicacao.valorPercent}
              deltaPp={placar.aplicacao.deltaPp}
              descricao="Aplicação em situações práticas"
            />
            <IndicadorPlacar
              chave="evolucao"
              rotulo="Evolução"
              valorPercent={placar.evolucao.valorPercent}
              deltaPp={placar.evolucao.deltaPp}
              descricao="Variação vs. período anterior"
            />
          </div>
        ) : (
          <TextoVazio texto={placar.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

function BlocoMudancas({ mudancas }: { mudancas: VisaoGeralAprendizagemDados["mudancas"] }) {
  const temConteudo = mudancas.estado === "ok" && mudancas.sinais.length > 0
  return (
    <Card className="relative flex-1 p-[20px]">
      <CardTitulo>O que mudou</CardTitulo>
      <MioloCard
        centrado={mudancas.estado !== "ok" || mudancas.sinais.length === 0}
        className="mt-[12px]"
      >
        {mudancas.estado === "ok" ? (
          mudancas.sinais.length > 0 ? (
            <ul className="space-y-[10px]">
              {mudancas.sinais.map((s) => (
                <li key={s.id} className="flex items-start gap-[8px]">
                  <CirculoIcone
                    tom={s.tom === "positivo" ? "green" : s.tom === "negativo" ? "red" : "neutral"}
                    diametro={18}
                  >
                    <TrendingUp size={11} strokeWidth={2.4} />
                  </CirculoIcone>
                  <p className="text-[13px] leading-[18px]" style={{ color: TEXTO.secundario }}>
                    {s.texto}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <TextoVazio texto="Nenhuma mudança relevante neste período." />
          )
        ) : (
          <TextoVazio texto={mudancas.textoVazio} />
        )}
      </MioloCard>
      {temConteudo && <LinkRodape rotulo="Ver detalhes" />}
    </Card>
  )
}

function BlocoAtencao({ atencao }: { atencao: VisaoGeralAprendizagemDados["atencao"] }) {
  return (
    <Card className="flex-1 p-[20px]">
      <CardTituloComInfo dica="Gaps de aprendizagem priorizados por número de pessoas impactadas, relevância e persistência.">
        O que merece atenção agora?
      </CardTituloComInfo>
      <MioloCard
        centrado={atencao.estado !== "ok" || atencao.itens.length === 0}
        className="mt-[12px]"
      >
        {atencao.estado === "ok" ? (
          atencao.itens.length > 0 ? (
            <ul className="space-y-[14px]">
              {atencao.itens.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-[12px]">
                  <div>
                    <p
                      className="text-[13px] leading-[18px] font-semibold"
                      style={{ color: TEXTO.primario }}
                    >
                      {item.gap}
                    </p>
                    <p className="text-[12.5px] leading-[17px]" style={{ color: TEXTO.terciario }}>
                      {item.resumo}
                    </p>
                  </div>
                  <CtaPilula rotulo={item.acaoSugerida} className="shrink-0 px-[12px] py-[7px]" />
                </li>
              ))}
            </ul>
          ) : (
            <TextoVazio texto="Nenhum gap prioritário identificado neste período." />
          )
        ) : (
          <TextoVazio texto={atencao.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

/** Badge numerado — mesma anatomia do `NumeroPasso` de Mapa da Jornada (Ø22, contorno). */
function NumeroRecomendacao({ numero }: { numero: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
      style={{ width: 22, height: 22, backgroundColor: "#FCE6CC", color: "#E07104" }}
    >
      {numero}
    </span>
  )
}

function BlocoRecomendacoes({
  recomendacoes,
}: { recomendacoes: VisaoGeralAprendizagemDados["recomendacoes"] }) {
  return (
    <Card className="flex-1 p-[20px]">
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
                  <div className="flex items-start gap-[10px]">
                    <NumeroRecomendacao numero={r.prioridade} />
                    <div>
                      <p
                        className="text-[13px] leading-[18px] font-semibold"
                        style={{ color: TEXTO.primario }}
                      >
                        {r.titulo}
                      </p>
                      <p
                        className="text-[12.5px] leading-[17px]"
                        style={{ color: TEXTO.terciario }}
                      >
                        {r.contexto}
                      </p>
                    </div>
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
    </Card>
  )
}

function BlocoCapacidadesEvolucao({
  capacidadesEvolucao,
}: { capacidadesEvolucao: VisaoGeralAprendizagemDados["capacidadesEvolucao"] }) {
  return (
    <Card className="flex-1 p-[20px]">
      <CardTituloComInfo dica="Tendência coletiva de evolução — ainda não é o mesmo que declarar capacidade individual demonstrada.">
        Capacidades com maior evolução
      </CardTituloComInfo>
      <MioloCard
        centrado={capacidadesEvolucao.estado !== "ok" || capacidadesEvolucao.linhas.length === 0}
        className="mt-[14px]"
      >
        {capacidadesEvolucao.estado === "ok" ? (
          capacidadesEvolucao.linhas.length > 0 ? (
            <ul className="space-y-[14px]">
              {capacidadesEvolucao.linhas.map((c) => (
                <li key={c.capacidadeId}>
                  <div className="flex items-center justify-between gap-[8px]">
                    <span
                      className="text-[13px] leading-[18px]"
                      style={{ color: TEXTO.secundario }}
                    >
                      {c.titulo}
                    </span>
                    <span className="flex items-center gap-[8px] shrink-0">
                      <span
                        className="text-[13px] leading-[18px] font-semibold"
                        style={{ color: TEXTO.primario }}
                      >
                        {c.estadoColetivoPercent}%
                      </span>
                      {c.deltaPp !== null && (
                        <span
                          className="text-[12px] leading-[16px] font-semibold"
                          style={{ color: c.deltaPp >= 0 ? "#2E9E6B" : "#DE3B36" }}
                        >
                          {c.deltaPp >= 0 ? "↑" : "↓"} {Math.abs(c.deltaPp)} p.p.
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-[6px]">
                    <BarraPercent percent={c.estadoColetivoPercent} tom="green" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <TextoVazio texto="Ainda não há evolução mensurável neste período." />
          )
        ) : (
          <TextoVazio texto={capacidadesEvolucao.textoVazio} />
        )}
      </MioloCard>
    </Card>
  )
}

function BlocoGapsPrioritarios({
  gapsPrioritarios,
}: { gapsPrioritarios: VisaoGeralAprendizagemDados["gapsPrioritarios"] }) {
  const temConteudo = gapsPrioritarios.estado === "ok" && gapsPrioritarios.linhas.length > 0
  return (
    <Card className="relative flex-1 p-[20px]">
      <CardTituloComInfo dica="Capacidades com maior número de pessoas impactadas neste período, priorizadas para intervenção.">
        Gaps prioritários
      </CardTituloComInfo>
      <MioloCard
        centrado={gapsPrioritarios.estado !== "ok" || gapsPrioritarios.linhas.length === 0}
        className="mt-[12px]"
      >
        {gapsPrioritarios.estado === "ok" ? (
          gapsPrioritarios.linhas.length > 0 ? (
            <ul className="space-y-[12px]">
              {gapsPrioritarios.linhas.map((g) => (
                <li key={g.capacidadeId} className="flex items-start gap-[8px]">
                  <CirculoIcone tom="amber" diametro={18}>
                    <Target size={11} strokeWidth={2.4} />
                  </CirculoIcone>
                  <div>
                    <p
                      className="text-[13px] leading-[18px] font-semibold"
                      style={{ color: TEXTO.primario }}
                    >
                      {g.titulo}
                    </p>
                    <p className="text-[12px] leading-[16px]" style={{ color: TEXTO.terciario }}>
                      {g.descricao} · {g.pessoasImpactadas} pessoas ({g.percentImpactado}%)
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <TextoVazio texto="Nenhum gargalo relevante foi identificado neste período." />
          )
        ) : (
          <TextoVazio texto={gapsPrioritarios.textoVazio} />
        )}
      </MioloCard>
      {temConteudo && <LinkRodape rotulo="Ver recomendações" />}
    </Card>
  )
}

export function VisaoGeralAprendizagemTab({ data }: { data: VisaoGeralAprendizagemDados }) {
  if (data.estado === "erro") {
    return (
      <div className={`${RECUO_DA_COLUNA} py-[24px]`}>
        <CardFalhaDeLeitura
          titulo="Não foi possível carregar a Aprendizagem do Time"
          falha={data.erro}
        />
      </div>
    )
  }

  return (
    <div className={`${RECUO_DA_COLUNA} flex flex-col gap-[14px] py-[8px]`}>
      <div className="flex gap-[14px]">
        <BlocoPlacar placar={data.placar} />
        <BlocoMudancas mudancas={data.mudancas} />
      </div>
      <div className="flex gap-[14px]">
        <BlocoAtencao atencao={data.atencao} />
        <BlocoRecomendacoes recomendacoes={data.recomendacoes} />
      </div>
      <div className="flex gap-[14px]">
        <BlocoCapacidadesEvolucao capacidadesEvolucao={data.capacidadesEvolucao} />
        <BlocoGapsPrioritarios gapsPrioritarios={data.gapsPrioritarios} />
      </div>
    </div>
  )
}
