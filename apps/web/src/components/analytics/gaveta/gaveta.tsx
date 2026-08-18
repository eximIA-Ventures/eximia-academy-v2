"use client"

// ---------------------------------------------------------------------------
// A GAVETA — a superfície de investigação da §30, uma só para as três abas.
// ---------------------------------------------------------------------------
// §30: "a pessoa é nível de INVESTIGAÇÃO, não aba principal. Qualquer indicador
// relevante pode ter *Ver pessoas*, abrindo drawer/modal lateral."
//
// POR QUE UM PAINEL LATERAL E NÃO UMA PÁGINA. A tela do gestor é de triagem: ele
// está lendo uma fila e quer olhar UMA pessoa sem perder a fila. `/analytics/
// students/{id}` (que era o destino do nome do aluno na Visão geral) desmonta a
// tela inteira, e voltar recarrega tudo — o gestor perde o recorte que estava
// lendo. O painel preserva a tela atrás dele, que é literalmente o que a §30
// pede ao dizer "drawer/modal lateral".
//
// DUAS FORMAS, MESMO MECANISMO:
//   • `pessoas` — os 8 campos da §30, com o que a §30 PROÍBE ausente do tipo
//     (`lib/analytics/gaveta/tipos.ts`);
//   • `tabela`  — o "ver tudo" de listas que não são de gente (módulos, semanas,
//     mudanças). É o que faz os 13 CTAs inertes das abas Padrões e Mapa terem
//     destino sem inventar rota nenhuma.
//
// INERTE FORA DO PROVEDOR, de propósito: a rota `/gauntlet-preview/*` renderiza
// os componentes sem roteador e sem sessão, e o screenshot precisa continuar
// byte a byte igual. `abrir` cai num no-op e nenhum gatilho quebra.
//
// SOMENTE LEITURA. Nada aqui escreve em banco. Os botões que escrevem são os de
// `visao-geral/acoes.tsx`, com gate próprio e desligado por padrão.
// ---------------------------------------------------------------------------

import type { ConteudoGaveta, LeituraAssistida, PessoaDaGaveta } from "@/lib/analytics/gaveta/tipos"
import { ChevronRight, X } from "lucide-react"
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react"
import { COR_ACAO, COR_TILE, RAIO_TILE, TEXTO, TOM_ICONE_SUAVE } from "../visao-geral/design"

interface ValorGaveta {
  abrir: (conteudo: ConteudoGaveta) => void
}

const Contexto = createContext<ValorGaveta>({ abrir: () => {} })

export function useGaveta(): ValorGaveta {
  return useContext(Contexto)
}

export function ProvedorGaveta({ children }: { children: ReactNode }) {
  const [conteudo, setConteudo] = useState<ConteudoGaveta | null>(null)
  const abrir = useCallback((c: ConteudoGaveta) => setConteudo(c), [])
  const valor = useMemo(() => ({ abrir }), [abrir])

  return (
    <Contexto.Provider value={valor}>
      {children}
      {conteudo ? <Painel conteudo={conteudo} onFechar={() => setConteudo(null)} /> : null}
    </Contexto.Provider>
  )
}

// ===========================================================================
// Gatilhos — o que transforma um rótulo em porta de entrada
// ===========================================================================

/**
 * O NOME DA PESSOA vira porta.
 *
 * `<button>` e não `<a>`: não há navegação, e um link que não navega é uma
 * promessa falsa para teclado e leitor de tela. A tipografia é herdada
 * (`text-left`, sem cor própria), então a linha da tabela continua medindo o que
 * media — a régua visual das três abas não se move por causa disto.
 */
export function GatilhoPessoa({
  pessoa,
  className = "",
  children,
}: {
  /** `null` ⇒ o gatilho degrada para texto puro, sem virar botão morto. */
  pessoa: PessoaDaGaveta | null
  className?: string
  children: ReactNode
}) {
  const { abrir } = useGaveta()
  if (!pessoa) return <span className={className}>{children}</span>
  return (
    <button
      type="button"
      className={`cursor-pointer text-left ${className}`}
      title={`Ver ${pessoa.nome}`}
      onClick={() =>
        abrir({
          tipo: "pessoas",
          titulo: pessoa.nome,
          subtitulo: pessoa.statusRotulo,
          nota: NOTA_PESSOA,
          pessoas: [pessoa],
          textoVazio: "",
        })
      }
    >
      {children}
    </button>
  )
}

/**
 * A régua que viaja com TODA gaveta de pessoa (I-2, renderizada).
 *
 * Ela existe porque uma lista nominal de gente, sem dizer o que ela é, lê-se
 * como lista de infratores. A §2 Regra 2 e o invariante I-8 são o motivo: esta
 * superfície apoia, não vigia.
 */
export const NOTA_PESSOA =
  "Fila de apoio, não classificação. Sem posição, sem nota e sem conteúdo de reflexão."

// ===========================================================================
// O painel
// ===========================================================================

function Painel({ conteudo, onFechar }: { conteudo: ConteudoGaveta; onFechar: () => void }) {
  return (
    // `<dialog open>` pelo mesmo motivo de `acoes.tsx`: o elemento nativo já
    // carrega o papel, e as classes neutralizam o estilo do agente de usuário
    // (que senão centraria uma caixa branca com borda por cima da nossa).
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none justify-end border-0 bg-black/35 p-0"
      aria-modal="true"
      aria-label={conteudo.titulo}
    >
      {/* A cortina fecha a gaveta. `aria-hidden` + `tabIndex={-1}`: o caminho de
          teclado é o botão de fechar, que é o primeiro elemento focável dentro
          do painel — um segundo alvo invisível na ordem de tabulação seria ruído
          para leitor de tela. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className="flex-1 cursor-default"
        onClick={onFechar}
      />
      <section
        className="flex h-full w-[520px] max-w-full flex-col overflow-auto bg-white px-[24px] pt-[20px] pb-[24px]"
        style={{ color: TEXTO.primario }}
      >
        <div className="flex items-start justify-between gap-[16px]">
          <div className="min-w-0">
            <h2
              className="text-[17px] leading-[22px] font-bold"
              style={{ letterSpacing: "-0.012em" }}
            >
              {conteudo.titulo}
            </h2>
            <p
              className="mt-[3px] text-[11.5px] leading-[16px]"
              style={{ color: TEXTO.terciario, letterSpacing: "-0.004em" }}
            >
              {conteudo.subtitulo}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="shrink-0"
            style={{ color: TEXTO.mudo }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* A régua do recorte, sempre visível (I-2). Nunca `title`. */}
        <p
          className="mt-[10px] text-[10.5px] leading-[15px]"
          style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
        >
          {conteudo.nota}
        </p>

        {conteudo.tipo === "pessoas" ? (
          <ListaDePessoas recorte={conteudo} />
        ) : (
          <>
            {conteudo.leituraAssistida ? (
              <LeituraDoPeriodo leitura={conteudo.leituraAssistida} />
            ) : null}
            <TabelaLonga recorte={conteudo} />
          </>
        )}
      </section>
    </dialog>
  )
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p
      className="mt-[16px] text-[11.5px] leading-[16px]"
      style={{ color: TEXTO.secundario, letterSpacing: "-0.004em" }}
    >
      {texto}
    </p>
  )
}

/** Campo da ficha. `null` vira frase, NUNCA zero nem célula em branco (I-3). */
function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex gap-[10px] py-[3px]">
      <span
        className="w-[132px] shrink-0 text-[10.5px] leading-[16px]"
        style={{ color: TEXTO.mudo }}
      >
        {rotulo}
      </span>
      <span
        className="min-w-0 flex-1 text-[11.5px] leading-[16px]"
        style={{ color: valor === null ? TEXTO.mudo : TEXTO.primario }}
      >
        {valor ?? "Não medido nesta visão."}
      </span>
    </div>
  )
}

function FichaDaPessoa({ pessoa }: { pessoa: PessoaDaGaveta }) {
  const { fill, ink } = TOM_ICONE_SUAVE[pessoa.avatarTone]
  return (
    <li
      className="mt-[10px] px-[13px] pt-[11px] pb-[11px]"
      style={{ backgroundColor: COR_TILE, borderRadius: RAIO_TILE }}
    >
      <div className="flex items-center gap-[10px]">
        <span
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ backgroundColor: fill, color: ink, letterSpacing: "-0.01em" }}
        >
          {pessoa.iniciais}
        </span>
        <span className="min-w-0">
          <span
            className="block text-[12.5px] leading-[16px] font-bold"
            style={{ letterSpacing: "-0.008em" }}
          >
            {pessoa.nome}
          </span>
          <span
            className="block text-[11px] leading-[16px]"
            style={{ color: TEXTO.secundario, letterSpacing: "-0.004em" }}
          >
            {pessoa.statusRotulo}
          </span>
        </span>
      </div>

      {/* Os campos da §30, nesta ordem. Nenhum a mais: o que a §30 proíbe não
          tem sequer campo no contrato (`lib/analytics/gaveta/tipos.ts`). */}
      <div className="mt-[8px]">
        <Campo rotulo="Curso" valor={pessoa.cursoRotulo} />
        <Campo rotulo="Progresso" valor={pessoa.progressoLabel} />
        <Campo rotulo="Último acesso" valor={pessoa.ultimoAcessoLabel} />
        <Campo rotulo="Frequência recente" valor={pessoa.frequenciaLabel} />
        <Campo rotulo="Sinal identificado" valor={pessoa.sinalLabel} />
        <Campo rotulo="Ação recomendada" valor={pessoa.acaoLabel} />
      </div>
    </li>
  )
}

function ListaDePessoas({ recorte }: { recorte: Extract<ConteudoGaveta, { tipo: "pessoas" }> }) {
  if (recorte.pessoas.length === 0) return <Vazio texto={recorte.textoVazio} />
  return (
    // Sem `<ol>` e sem numeral: fila de triagem, não pódio (I-8 / F-34a).
    <ul className="mt-[6px]">
      {recorte.pessoas.map((p) => (
        <FichaDaPessoa key={p.id} pessoa={p} />
      ))}
    </ul>
  )
}

// ===========================================================================
// A leitura do período — a regra sempre, a IA só se pedirem
// ===========================================================================

/**
 * O ÚNICO ponto de IA destas três telas, e ele é ADITIVO.
 *
 * O que está SEMPRE na tela é a frase das regras §29 (`leituraDeterministica`),
 * com a ação que elas sugerem. Ela não sai daqui em nenhuma hipótese: não é o
 * "estado de carregamento" da IA nem o consolo de quando ela falha — é a
 * leitura oficial da casa, e a IA entra ao lado dela, nunca no lugar.
 *
 * O botão é a garantia 4: nenhum render chama a rota. Um `useEffect` aqui
 * transformaria abrir uma gaveta em gastar dinheiro, e transformaria uma tela
 * de leitura numa que faz rede sozinha.
 *
 * Quando a IA responde, o parágrafo aparece MARCADO como interpretação (garantia
 * 1) e os números dele já passaram pelo gate de `verificacao.ts` no servidor
 * (garantia 2). Qualquer falha — sem chave, sem rede, número sem lastro —
 * devolve uma frase discreta e a régua continua de pé (garantia 3).
 */
function LeituraDoPeriodo({ leitura }: { leitura: LeituraAssistida }) {
  const [situacao, setSituacao] = useState<"parada" | "carregando" | "pronta" | "indisponivel">(
    "parada",
  )
  const [texto, setTexto] = useState<string | null>(null)

  async function pedirLeitura() {
    setSituacao("carregando")
    try {
      const resposta = await fetch("/api/analytics/leitura-do-periodo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fatos: leitura.fatos,
          leituraDeterministica: leitura.leituraDeterministica,
          acaoDeterministica: leitura.acaoDeterministica,
          periodoDias: leitura.periodoDias,
          totalRecorte: leitura.totalRecorte,
        }),
      })
      const dados = await resposta.json().catch(() => null)
      if (resposta.ok && dados?.ok === true && typeof dados.texto === "string") {
        setTexto(dados.texto)
        setSituacao("pronta")
        return
      }
      setSituacao("indisponivel")
    } catch {
      // Rede caiu com a gaveta aberta. A régua abaixo não se mexe.
      setSituacao("indisponivel")
    }
  }

  return (
    <section
      className="mt-[14px] px-[13px] pt-[11px] pb-[12px]"
      style={{ backgroundColor: COR_TILE, borderRadius: RAIO_TILE }}
    >
      <h3
        className="text-[10.5px] leading-[15px] font-semibold"
        style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
      >
        Leitura do período
      </h3>
      <p
        className="mt-[5px] text-[11.5px] leading-[17px]"
        style={{ color: TEXTO.primario, letterSpacing: "-0.004em" }}
      >
        {leitura.leituraDeterministica}
      </p>
      <p
        className="mt-[6px] text-[11.5px] leading-[17px]"
        style={{ color: TEXTO.secundario, letterSpacing: "-0.004em" }}
      >
        {leitura.acaoDeterministica}
      </p>

      {situacao === "pronta" && texto ? (
        // A marcação de INTERPRETAÇÃO é estrutural, não decorativa: barra
        // lateral, rótulo próprio e a frase que diz de onde vieram os números.
        <div className="mt-[11px] pl-[9px]" style={{ borderLeft: `2px solid ${COR_ACAO}` }}>
          <p
            className="text-[10px] leading-[14px] font-semibold"
            style={{ color: COR_ACAO, letterSpacing: "0.01em" }}
          >
            INTERPRETAÇÃO ASSISTIDA POR IA
          </p>
          <p
            className="mt-[3px] text-[11.5px] leading-[17px]"
            style={{ color: TEXTO.primario, letterSpacing: "-0.004em" }}
          >
            {texto}
          </p>
          <p className="mt-[4px] text-[10px] leading-[14px]" style={{ color: TEXTO.mudo }}>
            Redigida a partir dos números da tabela abaixo. O modelo não calcula: todo número citado
            é conferido contra os dados antes de aparecer aqui.
          </p>
        </div>
      ) : null}

      {situacao === "indisponivel" ? (
        <p className="mt-[9px] text-[10.5px] leading-[15px]" style={{ color: TEXTO.mudo }}>
          A leitura assistida não está disponível agora. A leitura acima é a das regras e não
          depende dela.
        </p>
      ) : null}

      {situacao === "parada" || situacao === "carregando" ? (
        <button
          type="button"
          onClick={pedirLeitura}
          disabled={situacao === "carregando"}
          className="mt-[10px] inline-flex w-fit cursor-pointer items-center rounded-[8px] px-[11px] py-[5px] text-[10.5px] font-semibold disabled:cursor-default"
          style={{
            border: `1px solid ${COR_ACAO}`,
            color: COR_ACAO,
            backgroundColor: "#FFFFFF",
            opacity: situacao === "carregando" ? 0.6 : 1,
          }}
        >
          {situacao === "carregando" ? "Redigindo…" : "Resumir em linguagem de gestor"}
        </button>
      ) : null}
    </section>
  )
}

function TabelaLonga({ recorte }: { recorte: Extract<ConteudoGaveta, { tipo: "tabela" }> }) {
  if (recorte.linhas.length === 0) return <Vazio texto={recorte.textoVazio} />
  return (
    <table className="mt-[14px] w-full border-collapse">
      <thead>
        <tr style={{ borderBottom: "1px solid #E0DCD9" }}>
          {recorte.colunas.map((coluna, i) => (
            <th
              key={coluna}
              className={`pb-[5px] text-[10.5px] leading-[15px] font-semibold ${
                recorte.alinhamentos[i] === "direita" ? "text-right" : "text-left"
              }`}
              style={{ color: TEXTO.mudo }}
            >
              {coluna}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {recorte.linhas.map((linha, indice) => (
          <tr
            // A chave é a primeira célula (o identificador natural da linha:
            // módulo, semana, indicador) com o índice de desempate — duas linhas
            // podem legitimamente repetir o rótulo em tabelas de série.
            key={`${linha[0] ?? ""}-${indice}`}
            style={{ borderTop: indice === 0 ? undefined : "1px solid #F0EDEB" }}
          >
            {linha.map((celula, i) => (
              <td
                key={recorte.colunas[i] ?? `c-${i}`}
                className={`py-[6px] text-[11.5px] leading-[16px] ${
                  recorte.alinhamentos[i] === "direita" ? "text-right tabular-nums" : "text-left"
                }`}
                style={{ color: i === 0 ? TEXTO.primario : TEXTO.secundario }}
              >
                {celula}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ===========================================================================
// Os dois gatilhos de "ver tudo"
// ===========================================================================

/**
 * O CTA de rodapé de card (`LinkRodape`) que ABRE a gaveta em vez de navegar.
 *
 * A geometria é COPIADA de `design.tsx`, classe por classe (`right-[18px]`, vão
 * de 13px antes do chevron, 11,5px semibold): trocar `<span>` por `<button>`
 * não pode deslocar a régua, senão ligar os CTAs mexeria na foto do gauntlet.
 * Um `<button>` herda `text-align: center` do agente de usuário — daí o
 * `text-left` explícito, que é a única classe a mais.
 */
export function BotaoRodapeGaveta({
  rotulo,
  conteudo,
}: {
  rotulo: string
  conteudo: ConteudoGaveta
}) {
  const { abrir } = useGaveta()
  return (
    <button
      type="button"
      onClick={() => abrir(conteudo)}
      className="absolute right-[18px] flex cursor-pointer items-center text-left text-[11.5px] leading-[16px] font-semibold whitespace-nowrap"
      style={{ color: COR_ACAO, letterSpacing: "-0.015em" }}
    >
      {rotulo}
      <ChevronRight size={13} strokeWidth={2.6} className="ml-[13px]" />
    </button>
  )
}

/**
 * O CTA "de contorno" (pílula com borda laranja) que abre a gaveta.
 *
 * Mesmo desenho dos `<span>` que existiam em "Ver pessoas (N)" e "Ver
 * recomendações" no Mapa — eles JÁ pareciam botão; o que faltava era serem um.
 */
export function BotaoContornoGaveta({
  rotulo,
  conteudo,
  className = "",
}: {
  rotulo: string
  conteudo: ConteudoGaveta
  className?: string
}) {
  const { abrir } = useGaveta()
  return (
    <button
      type="button"
      onClick={() => abrir(conteudo)}
      className={`inline-flex w-fit cursor-pointer items-center rounded-[8px] px-[12px] py-[6px] text-[11px] font-semibold ${className}`}
      style={{ border: `1px solid ${COR_ACAO}`, color: COR_ACAO, backgroundColor: "#FFFFFF" }}
    >
      {rotulo}
    </button>
  )
}
