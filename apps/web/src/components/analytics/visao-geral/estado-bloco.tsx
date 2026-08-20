// ---------------------------------------------------------------------------
// Como cada card se comporta quando NÃO tem número para mostrar.
// ---------------------------------------------------------------------------
// Existe um arquivo só para isto porque a decisão é a mesma nos seis blocos, e
// espalhá-la seis vezes é como ela vira cinco. As três situações do contrato
// (`tipos.ts` → `EstadoBloco`) e o que cada uma renderiza:
//
//   ok    → o bloco desenha os números normalmente;
//   vazio → o bloco desenha a FRASE (§32) e NENHUM numeral. "0%" e "você ainda
//           não acionou ninguém" são mensagens opostas a partir do mesmo dado
//           ausente — é o invariante I-3, e é o motivo de o placar sumir em vez
//           de zerar;
//   erro  → o bloco diz que falhou. NUNCA cai no caminho `vazio`: falha de
//           leitura apresentada como "não houve" é exatamente o achado A-1
//           (79 de 87 páginas de `(platform)` descartam o `error` do
//           supabase-js e apresentam tela limpa como fato). É o invariante I-4
//           chegando até o pixel.
//
// O texto de `vazio` vem do DADO (`textoVazio`, escrito pela camada que sabe
// POR QUE está vazio), não de uma constante escolhida aqui. Só há fallback para
// o caso de um produtor esquecer de preenchê-lo.
// ---------------------------------------------------------------------------

import type { EstadoBloco } from "@/lib/analytics/visao-geral/tipos"
import { CircleAlert } from "lucide-react"
import { TEXTO } from "./design"

/** Todo bloco do contrato traz estes campos, opcionais na fixture. */
export type ComEstadoParcial = Partial<EstadoBloco>

export function situacaoDo(bloco: ComEstadoParcial): "ok" | "vazio" | "erro" {
  return bloco.estado ?? "ok"
}

/** O que a tela diz quando a consulta falha. Espelha `textos.ts`. */
const ERRO_PADRAO = "Não foi possível carregar este bloco agora."

/** Último recurso: um produtor em `vazio` sem `textoVazio` é bug dele, não da UI. */
const VAZIO_PADRAO = "Ainda não há dados suficientes para este bloco."

/**
 * A frase que substitui os números. Mesma tipografia do corpo de card das peças
 * C/F (11,5px / lh 16), para o card não mudar de altura ao trocar de estado.
 */
export function FraseDoBloco({ texto }: { texto: string }) {
  return (
    <p
      className="mt-[14px] max-w-[560px] text-[11.5px] leading-[16px]"
      style={{ color: TEXTO.secundario, letterSpacing: "-0.004em" }}
    >
      {texto}
    </p>
  )
}

/**
 * O estado de ERRO. Deliberadamente diferente do vazio: ícone de alerta e a
 * causa técnica ao lado, para o gestor saber que está vendo uma falha e não um
 * fato sobre a equipe dele. `erro.mensagem` é a mensagem crua do PostgREST —
 * ela entra porque a alternativa (esconder) é o que produziu a auditoria A-1.
 */
export function FalhaDoBloco({ bloco }: { bloco: ComEstadoParcial }) {
  return (
    <div className="mt-[14px] flex max-w-[560px] items-start gap-[9px]">
      <CircleAlert
        size={15}
        strokeWidth={2}
        className="mt-[1px] shrink-0"
        style={{ color: "#E32D32" }}
      />
      <div className="flex flex-col">
        <span
          className="text-[11.5px] leading-[16px] font-semibold"
          style={{ color: TEXTO.primario, letterSpacing: "-0.004em" }}
        >
          {ERRO_PADRAO}
        </span>
        {bloco.erro ? (
          <span
            className="mt-[2px] text-[10.5px] leading-[15px]"
            style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
          >
            {bloco.erro.codigo}: {bloco.erro.mensagem}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/**
 * O despachante. Devolve `null` quando o bloco está `ok` — e é aí que quem
 * chama desenha os números. Escrito como "o que NÃO é ok" de propósito: a
 * ramificação fica impossível de esquecer no ponto de uso.
 */
export function CorpoNaoRenderizavel({ bloco }: { bloco: ComEstadoParcial }) {
  const situacao = situacaoDo(bloco)
  if (situacao === "ok") return null
  if (situacao === "erro") return <FalhaDoBloco bloco={bloco} />
  return <FraseDoBloco texto={bloco.textoVazio ?? VAZIO_PADRAO} />
}
