"use client"

// ---------------------------------------------------------------------------
// O CARD DE FALHA DE LEITURA das 3 telas de Aprendizagem do Time.
// ---------------------------------------------------------------------------
// Nasce do D2 da auditoria visual de 28/08 (`docs/auditoria/consolidacao-
// 2026-08-28/LOOP-3-visual.md` §3.4). Cada uma das 3 telas desenhava o próprio
// card de erro, e as 3 imprimiam `data.erro.mensagem` — a mensagem CRUA do
// motor de banco — direto na cara do gestor:
//
//     "Não foi possível carregar a Aprendizagem do Time
//      column capabilities.title does not exist"
//
// Três defeitos de uma vez: vaza nome de tabela e de coluna; fala inglês de
// banco a quem quer decidir sobre gente; e é beco sem saída (nem recarregar,
// nem caminho alternativo).
//
// O IDIOMA CERTO JÁ EXISTIA NESTA BASE, na Autogestão da Jornada: declarar a
// falha, prometer que nenhum número é exibido enquanto a leitura não for
// confiável, e dar o motivo em português (`FaltaProva`,
// `design-autogestao.tsx`). Este componente espelha esse padrão em vez de
// inventar um terceiro idioma de erro — e, por ser UM componente para as 3
// telas, a próxima tela do domínio não tem como recriar o vazamento.
//
// O QUE O GESTOR PRECISA SABER, e que a mensagem crua não dizia: que ISTO NÃO
// É "o time não estudou". Falha de leitura e ausência de aprendizagem são
// conclusões opostas, e confundi-las é a decisão errada mais cara desta tela.
//
// A mensagem do motor não some do mundo — ela vai para `data-erro-codigo` no
// DOM, legível por quem inspeciona ou coleta, invisível para quem lê a tela.
// ---------------------------------------------------------------------------

import type { FalhaLeitura } from "@/lib/analytics/aprendizagem-time/tipos"
import { hrefDoDominio } from "@/lib/analytics/dominios"
import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { COR_ACAO, Card, TEXTO } from "./design"

/** O literal que a Autogestão já usa — mesma promessa, mesmas palavras. */
const PROMESSA_SEM_NUMERO = "Nenhum número é exibido enquanto a leitura não for confiável."

/**
 * O esclarecimento que evita a leitura errada: falha de leitura NÃO é ausência
 * de aprendizagem. Sem esta frase, um gestor que vê a tela vazia conclui que a
 * equipe não estudou — e age em cima disso.
 */
const NAO_E_AUSENCIA_DE_APRENDIZAGEM =
  "A falha é na leitura dos dados, não uma medida sobre a sua equipe."

export function CardFalhaDeLeitura({
  titulo,
  falha,
}: {
  /** "Não foi possível carregar {isto}" — o escopo da tela que falhou. */
  titulo: string
  /** A falha crua. NUNCA renderizada como texto; só como atributo de DOM. */
  falha: FalhaLeitura | null
}) {
  const router = useRouter()

  return (
    <Card className="max-w-[640px] p-[20px]">
      {/*
        O código da falha fica no DOM, nunca no texto: quem inspeciona ou
        coleta acha; quem lê a tela não esbarra em vocabulário de banco.
        (`Card` é primitiva compartilhada e não repassa `data-*` — por isso o
        atributo mora aqui dentro, e não nela.)
      */}
      <div
        className="flex items-start gap-[10px]"
        data-erro-codigo={falha?.codigo ?? "desconhecido"}
      >
        <span className="mt-[2px] flex shrink-0" style={{ color: TEXTO.mudo }}>
          <AlertTriangle size={16} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold" style={{ color: TEXTO.primario }}>
            {titulo}
          </p>
          <p className="mt-[6px] text-[13px] leading-[18px]" style={{ color: TEXTO.secundario }}>
            {PROMESSA_SEM_NUMERO}
          </p>
          <p className="mt-[4px] text-[13px] leading-[18px]" style={{ color: TEXTO.terciario }}>
            {NAO_E_AUSENCIA_DE_APRENDIZAGEM}
          </p>

          {/*
            DUAS saídas, porque uma falha transitória e uma falha persistente
            pedem coisas diferentes: recarregar a leitura (`router.refresh()`
            re-executa o componente de servidor, não só o cliente), ou seguir
            para o domínio irmão, que não depende deste schema.
          */}
          <div className="mt-[14px] flex flex-wrap items-center gap-[14px]">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center gap-[6px] text-[13px] font-semibold"
              style={{ color: COR_ACAO }}
            >
              <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
              Tentar de novo
            </button>
            <Link
              href={hrefDoDominio("ativacao")}
              className="inline-flex items-center gap-[5px] text-[13px] font-semibold"
              style={{ color: COR_ACAO }}
            >
              Ver Ativação da Jornada
              <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </Card>
  )
}
