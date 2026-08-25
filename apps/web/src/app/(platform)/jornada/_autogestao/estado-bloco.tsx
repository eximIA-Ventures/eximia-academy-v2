// ---------------------------------------------------------------------------
// Como cada bloco da Autogestão se comporta quando NÃO tem número para mostrar.
// ---------------------------------------------------------------------------
// Cópia RETIPADA (não reinventada) de `components/analytics/visao-geral/
// estado-bloco.tsx`: a lógica e a tipografia são as MESMAS — ok/vazio/erro,
// `textoVazio` vindo do DADO nunca de uma constante local, erro nunca
// apresentado como "não houve" (mesmo invariante I-4/A-1 do gestor). O que
// muda é só o tipo de origem: `EstadoBloco` do gestor e o da Autogestão
// declaram os dois um campo `motivoVazio` com UNIÕES DE LITERAIS DIFERENTES
// (`MotivoAusencia` de cada domínio), e TypeScript não aceita a intersecção
// como subtipo do outro por causa disso — reusar o arquivo do gestor cru dá
// erro de compilação em todo call site desta tela. Duplicar aqui é a correção
// mínima: mesma anatomia, tipo certo.
// ---------------------------------------------------------------------------

import { TEXTO } from "@/components/analytics/visao-geral/design"
import type { EstadoBloco } from "@/lib/analytics/autogestao/tipos"
import { CircleAlert } from "lucide-react"

export type ComEstadoParcial = Partial<EstadoBloco>

export function situacaoDo(bloco: ComEstadoParcial): "ok" | "vazio" | "erro" {
  return bloco.estado ?? "ok"
}

const ERRO_PADRAO = "Não foi possível carregar este bloco agora."
const VAZIO_PADRAO = "Ainda não há dados suficientes para este bloco."

export function FraseDoBloco({ texto }: { texto: string }) {
  return (
    <p
      className="mt-[14px] max-w-[560px] text-[12.5px] leading-[18px]"
      style={{ color: TEXTO.secundario, letterSpacing: "-0.004em" }}
    >
      {texto}
    </p>
  )
}

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
          className="text-[12.5px] leading-[18px] font-semibold"
          style={{ color: TEXTO.primario, letterSpacing: "-0.004em" }}
        >
          {ERRO_PADRAO}
        </span>
        {bloco.erro ? (
          <span className="mt-[2px] text-[10.5px] leading-[15px]" style={{ color: TEXTO.mudo }}>
            {bloco.erro.codigo}: {bloco.erro.mensagem}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** `null` quando o bloco está `ok` — quem chama desenha os números aí. */
export function CorpoNaoRenderizavel({ bloco }: { bloco: ComEstadoParcial }) {
  const situacao = situacaoDo(bloco)
  if (situacao === "ok") return null
  if (situacao === "erro") return <FalhaDoBloco bloco={bloco} />
  return <FraseDoBloco texto={bloco.textoVazio ?? VAZIO_PADRAO} />
}
