"use client"

// ---------------------------------------------------------------------------
// Os botões que ESCREVEM — represados, com o envelope à vista.
// ---------------------------------------------------------------------------
// POR QUE O REPRESAMENTO EXISTE, e não é excesso de zelo: o `.env.local` deste
// repositório aponta para o Supabase de PRODUÇÃO. Um clique em "Reativar" aqui
// dispara `dispatchTeamNudge` e entrega uma notificação a um aluno real de um
// cliente real. Isso não tem desfazer. Enquanto o dono do produto não autorizar
// o disparo, o caminho é construído inteiro e a última linha fica desligada.
//
// O GATE é uma env var, lida NO SERVIDOR e passada como prop (`ativo`) — não
// lida aqui dentro. Duas razões: o valor fica visível para quem lê o painel, e
// o componente vira testável sem mexer em `process.env`.
//   • `NEXT_PUBLIC_ACIONAMENTO_ATIVO` — o nome pedido no briefing desta rodada;
//   • `NEXT_PUBLIC_VISAO_GERAL_ACOES_ATIVAS` — o nome que a camada de dados já
//     havia estabelecido (`lib/analytics/visao-geral/index.ts`).
// Os dois são aceitos, ambos ausentes por padrão, e a resolução é fail-closed:
// só liga se ALGUM deles for exatamente a string "true". Aceitar os dois é
// menos ruim que ter um nome documentado que silenciosamente não faz nada.
//
// COM O GATE DESLIGADO o botão continua clicável e abre a confirmação. Isso é
// deliberado: um botão inerte não deixa o dono do produto ver o que a tela FARIA
// — que é justamente o que ele precisa revisar antes de autorizar. A confirmação
// mostra o corpo LITERAL da requisição (o mesmo objeto que seria enviado, não
// uma paráfrase dele) e a lista nominal dos destinatários.
// ---------------------------------------------------------------------------

import type { NudgeType } from "@/types/notifications"
import { CircleAlert, Lock, X } from "lucide-react"
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react"
import { COR_ACAO, COR_BORDA_BOTAO, TEXTO } from "./design"

export interface DestinatarioAcionamento {
  id: string
  nome: string
}

export interface PedidoAcionamento {
  /** O rótulo do botão que originou o pedido ("Reativar", "Reconhecer", …). */
  rotulo: string
  nudgeType: NudgeType
  destinatarios: readonly DestinatarioAcionamento[]
}

/**
 * O corpo EXATO de `POST /api/engagement/action`.
 *
 * Uma função só, usada tanto para MOSTRAR quanto para ENVIAR. Se fossem duas, a
 * confirmação poderia divergir do que sai pela rede — que é o modo de falha que
 * torna uma tela de confirmação pior que nenhuma.
 *
 * `senderIdentity: "manager"` é intencional: a rota IGNORA qualquer nome vindo
 * do cliente e assina com o do chamador autenticado (trava documentada em
 * `api/engagement/action/route.ts`), então não há como assinar por outro.
 */
export function corpoDaRequisicao(pedido: PedidoAcionamento) {
  return {
    studentIds: pedido.destinatarios.map((d) => d.id),
    nudgeType: pedido.nudgeType,
    senderIdentity: "manager" as const,
    channel: "inapp" as const,
  }
}

interface ValorContexto {
  ativo: boolean
  pedir: (pedido: PedidoAcionamento) => void
}

/**
 * Default INERTE. Um botão de ação renderizado fora do provedor (a rota de
 * preview, por exemplo) não faz nada e não quebra — o preview precisa continuar
 * determinístico e sem roteador.
 */
const Contexto = createContext<ValorContexto>({ ativo: false, pedir: () => {} })

export function useAcoes(): ValorContexto {
  return useContext(Contexto)
}

type Situacao = "confirmando" | "enviando" | "enviado" | "falhou"

export function ProvedorAcoes({
  ativo,
  children,
}: {
  ativo: boolean
  children: ReactNode
}) {
  const [pedido, setPedido] = useState<PedidoAcionamento | null>(null)
  const [situacao, setSituacao] = useState<Situacao>("confirmando")
  const [erro, setErro] = useState<string | null>(null)

  const pedir = useCallback((p: PedidoAcionamento) => {
    setPedido(p)
    setSituacao("confirmando")
    setErro(null)
  }, [])

  const valor = useMemo(() => ({ ativo, pedir }), [ativo, pedir])

  const fechar = useCallback(() => setPedido(null), [])

  const confirmar = useCallback(async () => {
    if (!pedido || !ativo) return
    setSituacao("enviando")
    setErro(null)
    try {
      const resposta = await fetch("/api/engagement/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpoDaRequisicao(pedido)),
      })
      if (!resposta.ok) {
        // A rota devolve `{ error }` em JSON; um 5xx pode devolver HTML. As duas
        // hipóteses são tratadas — engolir a resposta aqui reproduziria, no
        // cliente, o mesmo defeito que I-4 combate no servidor.
        const detalhe = await resposta.json().catch(() => null)
        const mensagem =
          detalhe && typeof detalhe === "object" && "error" in detalhe
            ? String((detalhe as { error: unknown }).error)
            : `HTTP ${resposta.status}`
        setErro(mensagem)
        setSituacao("falhou")
        return
      }
      setSituacao("enviado")
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de rede")
      setSituacao("falhou")
    }
  }, [pedido, ativo])

  return (
    <Contexto.Provider value={valor}>
      {children}
      {pedido ? (
        <Confirmacao
          pedido={pedido}
          ativo={ativo}
          situacao={situacao}
          erro={erro}
          onFechar={fechar}
          onConfirmar={confirmar}
        />
      ) : null}
    </Contexto.Provider>
  )
}

function Confirmacao({
  pedido,
  ativo,
  situacao,
  erro,
  onFechar,
  onConfirmar,
}: {
  pedido: PedidoAcionamento
  ativo: boolean
  situacao: Situacao
  erro: string | null
  onFechar: () => void
  onConfirmar: () => void
}) {
  const corpo = corpoDaRequisicao(pedido)
  const quantos = pedido.destinatarios.length

  return (
    // `<dialog open>` e não `<div role="dialog">`: o elemento nativo já carrega
    // o papel. As classes neutralizam o estilo padrão do agente de usuário
    // (`m-0 border-0 max-h-none max-w-none h-full w-full`), que senão centraria
    // uma caixa branca com borda por cima da nossa. `open` em vez de
    // `showModal()` porque o resto desta tela é declarativo a partir do dado, e
    // um ciclo de vida imperativo por causa de um elemento não se paga.
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-black/40 p-6"
      aria-modal="true"
      aria-label={`Confirmar ${pedido.rotulo}`}
    >
      <div
        className="max-h-[80vh] w-[560px] overflow-auto rounded-[12px] bg-white p-[22px]"
        style={{ color: TEXTO.primario }}
      >
        <div className="flex items-start justify-between">
          <span
            className="text-[15px] leading-[20px] font-bold"
            style={{ letterSpacing: "-0.01em" }}
          >
            {pedido.rotulo} · {quantos} {quantos === 1 ? "pessoa" : "pessoas"}
          </span>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            style={{ color: TEXTO.mudo }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {!ativo ? (
          <div
            className="mt-[14px] flex items-start gap-[9px] rounded-[8px] p-[11px]"
            style={{ backgroundColor: "#FAF3EF" }}
          >
            <Lock
              size={15}
              strokeWidth={2}
              className="mt-[1px] shrink-0"
              style={{ color: COR_ACAO }}
            />
            <p className="text-[11.5px] leading-[16px]" style={{ color: TEXTO.secundario }}>
              Envio desligado. Este banco é o de <strong>produção</strong>, então nada é disparado
              sem autorização explícita do dono do produto. Abaixo está exatamente o que seria
              enviado. Para ligar:{" "}
              <code className="text-[10.5px]">NEXT_PUBLIC_ACIONAMENTO_ATIVO=true</code>.
            </p>
          </div>
        ) : null}

        <p
          className="mt-[16px] text-[11px] leading-[16px] font-semibold"
          style={{ color: TEXTO.secundario }}
        >
          Para quem
        </p>
        <ul className="mt-[5px] flex flex-col gap-[2px]">
          {pedido.destinatarios.map((d) => (
            <li
              key={d.id}
              className="text-[11.5px] leading-[16px]"
              style={{ color: TEXTO.primario }}
            >
              {d.nome}{" "}
              <span className="text-[10px]" style={{ color: TEXTO.mudo }}>
                {d.id}
              </span>
            </li>
          ))}
        </ul>

        <p
          className="mt-[16px] text-[11px] leading-[16px] font-semibold"
          style={{ color: TEXTO.secundario }}
        >
          O que seria enviado — corpo de <code>POST /api/engagement/action</code>
        </p>
        <pre
          className="mt-[5px] overflow-auto rounded-[8px] p-[11px] text-[10.5px] leading-[15px]"
          style={{ backgroundColor: "#FAF8F7", color: TEXTO.primario }}
        >
          {JSON.stringify(corpo, null, 2)}
        </pre>

        {situacao === "enviado" ? (
          <p
            className="mt-[14px] text-[11.5px] leading-[16px] font-semibold"
            style={{ color: "#17A06C" }}
          >
            Enviado.
          </p>
        ) : null}
        {situacao === "falhou" ? (
          <div className="mt-[14px] flex items-start gap-[8px]">
            <CircleAlert
              size={15}
              strokeWidth={2}
              className="mt-[1px] shrink-0"
              style={{ color: "#E32D32" }}
            />
            <p className="text-[11.5px] leading-[16px]" style={{ color: TEXTO.primario }}>
              Não foi enviado. {erro}
            </p>
          </div>
        ) : null}

        <div className="mt-[18px] flex justify-end gap-[9px]">
          <button
            type="button"
            onClick={onFechar}
            className="h-[30px] rounded-[8px] px-[14px] text-[11.5px] font-semibold"
            style={{ border: `1px solid ${COR_BORDA_BOTAO}`, color: COR_ACAO }}
          >
            {situacao === "enviado" ? "Fechar" : "Cancelar"}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!ativo || situacao === "enviando" || situacao === "enviado"}
            title={ativo ? undefined : "Envio desligado nesta instalação"}
            className="h-[30px] rounded-[8px] px-[14px] text-[11.5px] font-semibold text-white disabled:opacity-45"
            style={{ backgroundColor: COR_ACAO }}
          >
            {situacao === "enviando" ? "Enviando…" : `Confirmar ${pedido.rotulo.toLowerCase()}`}
          </button>
        </div>
      </div>
    </dialog>
  )
}
