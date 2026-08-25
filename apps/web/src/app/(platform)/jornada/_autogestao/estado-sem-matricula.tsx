// ---------------------------------------------------------------------------
// A Autogestão sem NENHUMA matrícula — o caso mais amplo que "sem plano"
// (CONTRATO-DE-DADOS.md, `ResultadoRecorteAutogestao["sem-matricula"]`).
// ---------------------------------------------------------------------------
// Sem curso nenhum não há o que colocar em abas: as 3 telas responderiam a
// mesma pergunta ("onde estou matriculado?") com a mesma ausência. Por isso
// este estado NÃO usa `<MolduraAutogestao/>` (que pressupõe um `courseId`
// resolvido) — é um cabeçalho próprio, mais simples, com a MESMA identidade
// tipográfica (`TEXTO`, mesmos tamanhos de H1/subtítulo).
// ---------------------------------------------------------------------------

import { Card, CardTitulo } from "@/components/analytics/autogestao/design-autogestao"
import { TEXTO } from "@/components/analytics/visao-geral/design"

export function EstadoSemMatricula() {
  return (
    <div className="pb-24 pl-[8px] pr-[16px] pt-2 sm:pl-[24px]" style={{ color: TEXTO.primario }}>
      <h1
        className="text-[28px] leading-[32px] font-bold sm:text-[33px] sm:leading-[36px]"
        style={{ color: TEXTO.primario, letterSpacing: "-0.021em", wordSpacing: "2px" }}
      >
        Autogestão da minha Jornada
      </h1>
      <p
        className="mt-[6px] max-w-[560px] text-[14.8px] leading-[20px]"
        style={{ color: TEXTO.terciario }}
      >
        Use seus dados para entender seus padrões, manter seu ritmo e decidir seus próximos passos.
      </p>

      <Card className="mt-[20px] max-w-[520px] p-[24px]">
        <CardTitulo>Você ainda não tem uma matrícula ativa</CardTitulo>
        <p className="mt-[8px] text-[13px] leading-[19px]" style={{ color: TEXTO.secundario }}>
          Assim que você for matriculado em um curso, sua Autogestão da minha Jornada aparece aqui.
        </p>
      </Card>
    </div>
  )
}
