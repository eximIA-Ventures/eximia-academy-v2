import { Button, Card, CardContent } from "@eximia/ui"
import { ArrowLeft } from "lucide-react"

interface EnneagramResult {
  type: number
  wing?: number
  scores: number[]
}

const ENNEAGRAM_TYPES: Record<number, { name: string; description: string }> = {
  1: { name: "Perfeccionista", description: "Busca a integridade e a excelencia. Responsavel, organizado e com altos padroes morais." },
  2: { name: "Prestativo", description: "Caloroso e generoso. Busca ser amado atraves do cuidado e atencao aos outros." },
  3: { name: "Realizador", description: "Orientado ao sucesso e eficiencia. Adaptavel, ambicioso e focado em resultados." },
  4: { name: "Individualista", description: "Criativo e sensivel. Busca autenticidade e profundidade emocional." },
  5: { name: "Investigador", description: "Observador e analitico. Valoriza conhecimento, competencia e independencia intelectual." },
  6: { name: "Leal", description: "Comprometido e responsavel. Valoriza seguranca, lealdade e confianca nos relacionamentos." },
  7: { name: "Entusiasta", description: "Otimista e versatil. Busca novas experiencias, liberdade e alegria na vida." },
  8: { name: "Desafiador", description: "Forte e decidido. Valoriza controle, justica e protecao dos mais vulneraveis." },
  9: { name: "Pacificador", description: "Receptivo e harmonioso. Busca paz interior e exterior, evitando conflitos." },
}

interface EnneagramResultsProps {
  result: EnneagramResult
  onBack: () => void
}

export function EnneagramResults({ result, onBack }: EnneagramResultsProps) {
  const typeInfo = ENNEAGRAM_TYPES[result.type]
  const wingInfo = result.wing ? ENNEAGRAM_TYPES[result.wing] : null

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-xl font-bold text-text-primary">Resultado — Eneagrama</h2>
      </div>

      <Card className="mb-4">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-blue-mid text-2xl font-bold text-white">
              {result.type}
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">
                Tipo {result.type} — {typeInfo?.name}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">{typeInfo?.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {wingInfo && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-text-muted">Asa (Wing)</p>
            <p className="mt-1 font-semibold text-text-primary">
              Tipo {result.wing} — {wingInfo.name}
            </p>
            <p className="mt-1 text-sm text-text-secondary">{wingInfo.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
