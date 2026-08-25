// ---------------------------------------------------------------------------
// Mapa de calor de atividade — Autogestão da minha Jornada, Tela 2.
// Pedido direto do dono (2026-08-24), fora dos itens 2.1-2.8 do
// CONTRATO-DE-DADOS.md — a camada de dados (`lib/analytics/autogestao/
// mapa-de-calor.ts`) já existe, testada, e é a ÚNICA fonte destes componentes.
// ---------------------------------------------------------------------------
// APRESENTAÇÃO PURA, mesmo padrão de `cartoes.tsx`: recebe o `resultado` já
// montado (`ResultadoMapaDeCalor`) e desenha. NÃO calcula nada, NÃO lê banco,
// NÃO decide o escopo (aluno ou time).
//
// REUSO DELIBERADO aluno×time: nenhum tipo consumido aqui (`GradeMapaDeCalor`,
// `CalendarioMapaDeCalor`, `ResultadoMapaDeCalor`, `tipos.ts`) carrega
// identidade de aluno. O MESMO componente, alimentado pelo escopo TIME
// (`carimbosDeAtividadeMultiplos`, ainda sem tela própria), desenha
// exatamente igual — o escopo é decisão de QUEM MONTA o `resultado`
// (`mapa-de-calor.ts`), nunca destes componentes. Por isso os dois cards
// vivem aqui como funções exportadas, importáveis de fora desta tela.
//
// SEM LASTRO (mesma regra de `serie.metaLinha`/`proximoMarco.prazo`, as duas
// outras ocorrências de `ComLastro` nesta tela): abaixo do piso
// (`MAPA_DE_CALOR_MIN_ATIVIDADES`), `resultado` é `SemLastro`, e os dois
// cards declaram a ausência com `FaltaProva` — a mesma peça, o mesmo texto
// "Falta prova." mais o motivo real — NUNCA uma grade vazia. Uma grade com
// 4% de células preenchidas (a mediana medida) é quase só ruído: a decisão do
// dono foi cortar a exibição inteira, não pintar 96 células cinza.
//
// CÉLULA COM ZERO × CÉLULA SEM DADO — não existe essa segunda categoria NESTE
// contrato. `montarGrade`/`montarCalendario` (mapa-de-calor.ts) sempre
// devolvem a grade INTEIRA e densa (84 células sempre; todo dia dentro de uma
// semana do calendário, sempre) — nunca uma célula "ausente" dentro de um
// `resultado` que TEM lastro. A única ausência possível é a do BLOCO inteiro
// (`SemLastro`), tratada acima, cartão a cartão. Por isso zero aqui já É a
// informação real ("nenhuma atividade nesta faixa/dia"), não um substituto
// mudo para "não sei" — e por isso o nível 0 da escala usa um tom NEUTRO (o
// mesmo cinza-pastel de "estado ausente" do resto da Autogestão), não o tom
// mais claro da família verde: ler "nível 0" como "quase verde" confundiria
// exatamente as duas coisas que este parágrafo separa.
//
// ESCALA DE COR POR QUANTIL, NÃO POR FRAÇÃO DO MÁXIMO — a razão de existir
// -------------------------------------------------------------------------
// Densidade medida pelo dono: time (324 sessões) preenche 50% das 84 células;
// o aluno MEDIANO preenche 4% — e nessas células preenchidas, a contagem por
// célula raramente passa de 2 ou 3. Uma escala LINEAR (`contagem / máximo`)
// com máximo=3 divide a faixa 0..1 em passos de ~0,33 — quase todo o miolo da
// escala (a diferença visual entre "1 vez" e "2 vezes") desaparece dentro do
// arredondamento de cor, e a grade lê como "tudo apagado" mesmo tendo sinal
// real. A correção (`limiaresDeQuantil`, abaixo) ordena os valores POSITIVOS
// que a própria grade contém e reparte em até 4 quartis — a célula mais ativa
// da grade SEMPRE ocupa o tom mais escuro da escala, não importa se ela vale
// 2 ou 50. É o mesmo princípio do mapa de contribuições do GitHub: a escala é
// relativa à AMOSTRA que está sendo desenhada, nunca a uma régua absoluta.
// ---------------------------------------------------------------------------

import {
  Card as CardPrimitivo,
  CardTitulo,
  FaltaProva,
  TEXTO,
  TOM_ICONE,
} from "@/components/analytics/autogestao/design-autogestao"
import {
  MAPA_DE_CALOR_FAIXAS,
  MAPA_DE_CALOR_HORAS_POR_FAIXA,
} from "@/lib/analytics/autogestao/parametros"
import type {
  CalendarioMapaDeCalor,
  GradeMapaDeCalor,
  ResultadoMapaDeCalor,
} from "@/lib/analytics/autogestao/tipos"
import { temLastro } from "@/lib/analytics/autogestao/tipos"
import { Fragment } from "react"

const DIAS_SEMANA_ABREV = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const

// ===========================================================================
// Escala de intensidade — 5 tons (0 = sem atividade, 1..4 = quartis crescentes)
// ===========================================================================

const NIVEIS_POSITIVOS = 4

/** Interpolação linear RGB entre dois hex — usada só para DERIVAR a paleta abaixo. */
function lerpHex(de: string, para: string, t: number): string {
  const a = Number.parseInt(de.slice(1), 16)
  const b = Number.parseInt(para.slice(1), 16)
  const canal = (v: number) => (v >> 16) & 0xff
  const canalG = (v: number) => (v >> 8) & 0xff
  const canalB = (v: number) => v & 0xff
  const r = Math.round(canal(a) + (canal(b) - canal(a)) * t)
  const g = Math.round(canalG(a) + (canalG(b) - canalG(a)) * t)
  const bl = Math.round(canalB(a) + (canalB(b) - canalB(a)) * t)
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

/**
 * 5 tons: [0]=neutro (sem atividade) · [1..4]=verde crescente, do MESMO par
 * `TOM_ICONE.green` que o resto da Autogestão já usa (fill→ink) — a escala é
 * derivada da paleta existente, não uma segunda paleta inventada para o mapa
 * de calor.
 */
const PALETA_INTENSIDADE: readonly string[] = [
  TOM_ICONE.neutral.fill,
  ...Array.from({ length: NIVEIS_POSITIVOS }, (_, i) =>
    lerpHex(TOM_ICONE.green.fill, TOM_ICONE.green.ink, i / (NIVEIS_POSITIVOS - 1)),
  ),
]

/**
 * Os limiares de quantil sobre os valores POSITIVOS realmente presentes nesta
 * grade — ver a nota de cabeçalho "ESCALA DE COR POR QUANTIL". `n` nunca
 * excede a quantidade de valores distintos observados: com 1 único valor
 * positivo, existe 1 limiar só (tudo que é >0 cai no tom mais escuro), nunca
 * 4 limiares repetidos fingindo variação que a amostra não tem.
 */
function limiaresDeQuantil(contagens: readonly number[]): readonly number[] {
  const positivos = [...new Set(contagens.filter((c) => c > 0))].sort((a, b) => a - b)
  if (positivos.length === 0) return []
  const n = Math.min(NIVEIS_POSITIVOS, positivos.length)
  const limiares: number[] = []
  for (let i = 1; i <= n; i++) {
    const indice = Math.min(positivos.length - 1, Math.ceil((positivos.length * i) / n) - 1)
    limiares.push(positivos[indice]!)
  }
  return limiares
}

/** Nível 0..4 de uma célula, dado os limiares JÁ calculados sobre a grade inteira. */
function nivelDe(contagem: number, limiares: readonly number[]): number {
  if (contagem <= 0) return 0
  for (let i = 0; i < limiares.length; i++) {
    if (contagem <= limiares[i]!) return i + 1
  }
  return limiares.length
}

/** "1 atividade" · "3 atividades" — nunca a contagem sozinha (mesmo hábito de `textos.ts`). */
function contagemAtividades(n: number): string {
  return `${n} ${n === 1 ? "atividade" : "atividades"}`
}

/**
 * A legenda da escala. Termos RELATIVOS ("Menos"/"Mais"), nunca um valor
 * absoluto ("1 atividade", "5 atividades") — os limiares são por QUANTIL da
 * amostra exibida (ver cabeçalho), então o mesmo tom não representa a mesma
 * contagem em dois cartões diferentes, e rotular por número mentiria sobre
 * comparabilidade que a escala não tem.
 */
function LegendaEscala() {
  return (
    <div
      className="flex items-center gap-[6px] text-[11px]"
      style={{ color: TEXTO.mudo }}
      aria-hidden="true"
    >
      <span>Menos</span>
      <div className="flex gap-[2px]">
        {PALETA_INTENSIDADE.map((cor) => (
          <span
            key={cor}
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ backgroundColor: cor }}
          />
        ))}
      </div>
      <span>Mais</span>
    </div>
  )
}

// ===========================================================================
// §A — Grade de horários: dia da semana (linha) × faixa de 2h (coluna)
// ===========================================================================

/** "0h–2h" · "22h–24h" — a partir de `MAPA_DE_CALOR_HORAS_POR_FAIXA`, nunca um literal solto. */
function rotuloFaixaCompleto(faixa: number): string {
  const inicio = faixa * MAPA_DE_CALOR_HORAS_POR_FAIXA
  const fim = inicio + MAPA_DE_CALOR_HORAS_POR_FAIXA
  return `${inicio}h–${fim}h`
}

function GradeHorarios({ grade }: { grade: GradeMapaDeCalor }) {
  const limiares = limiaresDeQuantil(grade.celulas.flat().map((c) => c.contagem))
  return (
    <div
      role="img"
      aria-label="Grade de horários de estudo, dia da semana por faixa de duas horas"
      className="grid gap-[3px]"
      style={{ gridTemplateColumns: `34px repeat(${MAPA_DE_CALOR_FAIXAS}, minmax(0, 1fr))` }}
    >
      {/* Cabeçalho: canto vazio + rótulo de cada faixa (só a hora de início, compacto). */}
      <span aria-hidden="true" />
      {Array.from({ length: MAPA_DE_CALOR_FAIXAS }, (_, faixa) => (
        <span
          key={faixa}
          aria-hidden="true"
          className="text-center text-[9px] leading-[12px]"
          style={{ color: TEXTO.mudo }}
        >
          {faixa * MAPA_DE_CALOR_HORAS_POR_FAIXA}
        </span>
      ))}
      {grade.celulas.map((linha, diaSemana) => (
        <Fragment key={DIAS_SEMANA_ABREV[diaSemana]}>
          <span
            aria-hidden="true"
            className="flex items-center text-[10.5px]"
            style={{ color: TEXTO.mudo }}
          >
            {DIAS_SEMANA_ABREV[diaSemana]}
          </span>
          {linha.map((celula) => {
            const nivel = nivelDe(celula.contagem, limiares)
            const rotulo = `${DIAS_SEMANA_ABREV[diaSemana]}, ${rotuloFaixaCompleto(
              celula.faixa,
            )}: ${contagemAtividades(celula.contagem)}`
            return (
              <div
                key={celula.faixa}
                data-celula-horario
                data-nivel={nivel}
                role="img"
                aria-label={rotulo}
                title={rotulo}
                className="h-[18px] rounded-[3px]"
                style={{ backgroundColor: PALETA_INTENSIDADE[nivel] }}
              />
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}

export function CardGradeHorarios({ resultado }: { resultado: ResultadoMapaDeCalor }) {
  return (
    <CardPrimitivo className="px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-x-[18px] gap-y-[6px]">
        <CardTitulo>Meus horários de estudo</CardTitulo>
        {temLastro(resultado) ? <LegendaEscala /> : null}
      </div>
      {temLastro(resultado) ? (
        <div className="mt-[12px]">
          <GradeHorarios grade={resultado.grade} />
        </div>
      ) : (
        <div className="mt-[12px] max-w-[560px]">
          <FaltaProva motivo={resultado.motivo} />
        </div>
      )}
    </CardPrimitivo>
  )
}

// ===========================================================================
// §B — Calendário de atividade: semana (coluna) × dia (linha), estilo GitHub
// ===========================================================================

/** "2/6" a partir de "2026-06-02" — leitura por índice de string, NUNCA `Date`/locale (I-6). */
function formatarDiaCalendario(diaUtc: string): string {
  const dia = Number.parseInt(diaUtc.slice(8, 10), 10)
  const mes = Number.parseInt(diaUtc.slice(5, 7), 10)
  return `${dia}/${mes}`
}

/**
 * O mês de uma semana, lido do PRÓPRIO rótulo que `rotuloSemana` já formata
 * ("26 mai – 1 jun" / "2 – 8 jun") — o último token é sempre o mês do FIM do
 * balde. Extrair do texto já pronto em vez de reabrir `diaUtc` com um parser
 * novo é o mesmo princípio de `partirRotuloTemporal` em `cartoes.tsx`: a
 * camada visual PARTE o que a montagem já produziu, nunca recalcula.
 */
function rotuloMesDe(rotulo: string): string {
  const partes = rotulo.trim().split(" ")
  return partes[partes.length - 1] ?? ""
}

function CalendarioSemanas({ calendario }: { calendario: CalendarioMapaDeCalor }) {
  const limiares = limiaresDeQuantil(
    calendario.semanas.flatMap((s) => s.dias.map((d) => d.contagem)),
  )
  // O rótulo de mês só aparece na PRIMEIRA semana em que aparece (como o eixo
  // de meses do GitHub) — calculado ANTES do JSX, para o `.map` de baixo não
  // carregar um efeito colateral de "mês anterior" dentro do desenho.
  const semanasComMes = calendario.semanas.map((semana, i) => {
    const mes = rotuloMesDe(semana.rotulo)
    const mesAnterior = i > 0 ? rotuloMesDe(calendario.semanas[i - 1]!.rotulo) : null
    return { semana, mes, mostrarMes: mes !== mesAnterior }
  })

  return (
    <div
      role="img"
      aria-label="Calendário de atividade por semana e dia, estilo mapa de contribuições"
      className="flex items-start gap-[3px] overflow-x-auto pb-[4px]"
    >
      <div className="flex flex-col gap-[3px] pt-[15px]">
        {DIAS_SEMANA_ABREV.map((rotulo) => (
          <span
            key={rotulo}
            aria-hidden="true"
            className="flex h-[13px] items-center text-[9px] leading-[11px]"
            style={{ color: TEXTO.mudo }}
          >
            {rotulo}
          </span>
        ))}
      </div>
      {semanasComMes.map(({ semana, mes, mostrarMes }) => (
        <div key={semana.indice} className="flex flex-col items-center gap-[3px]">
          <span
            aria-hidden="true"
            className="h-[12px] text-[9px] leading-[12px] whitespace-nowrap"
            style={{ color: TEXTO.mudo }}
          >
            {mostrarMes ? mes : ""}
          </span>
          {semana.dias.map((dia, i) => {
            const nivel = nivelDe(dia.contagem, limiares)
            const rotulo = `${formatarDiaCalendario(dia.diaUtc)}, ${
              DIAS_SEMANA_ABREV[i]
            }: ${contagemAtividades(dia.contagem)}`
            return (
              <div
                key={dia.diaUtc}
                data-celula-calendario
                data-nivel={nivel}
                role="img"
                aria-label={rotulo}
                title={rotulo}
                className="h-[13px] w-[13px] rounded-[3px]"
                style={{ backgroundColor: PALETA_INTENSIDADE[nivel] }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function CardCalendarioAtividade({ resultado }: { resultado: ResultadoMapaDeCalor }) {
  return (
    <CardPrimitivo className="px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-x-[18px] gap-y-[6px]">
        <CardTitulo>Meu calendário de atividade</CardTitulo>
        {temLastro(resultado) ? <LegendaEscala /> : null}
      </div>
      {temLastro(resultado) ? (
        <div className="mt-[12px]">
          <CalendarioSemanas calendario={resultado.calendario} />
        </div>
      ) : (
        <div className="mt-[12px] max-w-[560px]">
          <FaltaProva motivo={resultado.motivo} />
        </div>
      )}
    </CardPrimitivo>
  )
}
