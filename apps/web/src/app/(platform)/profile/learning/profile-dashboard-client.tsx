"use client"

import { Badge, Button } from "@eximia/ui"
import {
  Anchor,
  BookOpen,
  Brain,
  CheckCircle,
  FileUp,
  Hexagon,
  Lightbulb,
  Play,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

interface LearnerProfile {
  engagementStyle: string | null
  detailOrientation: string | null
  reasoningStyle: string | null
  kolbDominantStyle: string | null
  kolbStyleConfidence: number | null
  strengths: string[]
  growthAreas: string[]
  adaptationHints: string[]
  summary: string | null
  sessionCount: number
}

interface BigFiveResult {
  openness: number
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}

interface DISCResult {
  d: number
  i: number
  s: number
  c: number
  dominantType?: string
  secondaryType?: string
  typeLabel?: string
}

interface ProfileDashboardClientProps {
  learnerProfile: LearnerProfile | null
  bigFiveResult: BigFiveResult | null
  discResult: DISCResult | null
}

const BIG_FIVE_LABELS: Record<string, string> = {
  openness: "Abertura",
  conscientiousness: "Conscienciosidade",
  extraversion: "Extroversão",
  agreeableness: "Amabilidade",
  neuroticism: "Neuroticismo",
}

const DISC_LABELS: Record<string, { label: string; description: string }> = {
  D: { label: "Dominância", description: "Direto, decidido e orientado a resultados." },
  I: { label: "Influência", description: "Entusiasta, otimista e colaborativo." },
  S: { label: "Estabilidade", description: "Paciente, confiável e cooperativo." },
  C: { label: "Conformidade", description: "Analítico, preciso e detalhista." },
}

// Assessment cards config
const ASSESSMENTS = [
  {
    key: "disc",
    title: "DISC",
    description: "Estilo comportamental",
    href: "/assessments/disc",
    icon: Users,
    gradient: "from-cerrado-600/8",
    iconBg: "bg-cerrado-600/15",
    iconColor: "text-cerrado-600",
    hoverRing: "hover:ring-cerrado-600/25",
  },
  {
    key: "big_five",
    title: "Big Five",
    description: "5 dimensões de personalidade",
    href: "/assessments/big-five",
    icon: Brain,
    gradient: "from-accent-gold/8",
    iconBg: "bg-accent-gold/15",
    iconColor: "text-accent-gold",
    hoverRing: "hover:ring-accent-gold/25",
  },
  {
    key: "kolb",
    title: "Kolb",
    description: "Estilo de aprendizagem",
    href: "/assessments/kolb",
    icon: BookOpen,
    gradient: "from-varzea/8",
    iconBg: "bg-varzea/15",
    iconColor: "text-varzea",
    hoverRing: "hover:ring-varzea/25",
  },
  {
    key: "enneagram",
    title: "Eneagrama",
    description: "9 tipos de personalidade",
    href: "/assessments/enneagram",
    icon: Hexagon,
    gradient: "from-purple-500/8",
    iconBg: "bg-purple-500/15",
    iconColor: "text-purple-400",
    hoverRing: "hover:ring-purple-500/25",
  },
  {
    key: "multiple_intelligences",
    title: "Inteligências Múltiplas",
    description: "8 tipos de inteligência",
    href: "/assessments/multiple-intelligences",
    icon: Lightbulb,
    gradient: "from-teal-500/8",
    iconBg: "bg-teal-500/15",
    iconColor: "text-teal-400",
    hoverRing: "hover:ring-teal-500/25",
  },
  {
    key: "career_anchors",
    title: "Âncoras de Carreira",
    description: "Motivações profissionais",
    href: "/assessments/career-anchors",
    icon: Anchor,
    gradient: "from-amber-500/8",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    hoverRing: "hover:ring-amber-500/25",
  },
]

export function ProfileDashboardClient({
  learnerProfile,
  bigFiveResult,
  discResult,
}: ProfileDashboardClientProps) {
  const [choiceModal, setChoiceModal] = useState<typeof ASSESSMENTS[number] | null>(null)
  const [uploadModal, setUploadModal] = useState<typeof ASSESSMENTS[number] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const completedKeys = new Set<string>()
  if (discResult) completedKeys.add("disc")
  if (bigFiveResult) completedKeys.add("big_five")
  if (learnerProfile?.kolbDominantStyle) completedKeys.add("kolb")

  const completedCount = completedKeys.size
  const totalAssessments = ASSESSMENTS.length

  async function handleUpload(assessment: typeof ASSESSMENTS[number], file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("assessment_type", assessment.key)

      const res = await fetch("/api/assessments/upload", { method: "POST", body: formData })
      const data = await res.json()

      if (res.ok && data.success) {
        setUploadSuccess(true)
        setTimeout(() => {
          setUploadModal(null)
          setUploadSuccess(false)
          window.location.reload()
        }, 1500)
      } else {
        alert(data.error ?? "Erro ao processar o arquivo")
      }
    } catch {
      alert("Erro inesperado no upload")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Assessment Hub */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">Avaliações</h2>
            <p className="mt-0.5 text-sm text-text-secondary">
              {completedCount}/{totalAssessments} concluídas
            </p>
          </div>
          {completedCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-bg-elevated">
                <div className="h-full rounded-full bg-varzea transition-all duration-500" style={{ width: `${(completedCount / totalAssessments) * 100}%` }} />
              </div>
              <span className="text-xs font-semibold tabular-nums text-varzea">{Math.round((completedCount / totalAssessments) * 100)}%</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {ASSESSMENTS.map((assessment) => {
            const Icon = assessment.icon
            const isCompleted = completedKeys.has(assessment.key)

            return (
              <button
                key={assessment.key}
                type="button"
                onClick={() => isCompleted ? window.location.href = assessment.href : setChoiceModal(assessment)}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${assessment.gradient} via-bg-card to-bg-card shadow-card p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elevated ${assessment.hoverRing}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${assessment.iconBg}`}>
                    <Icon size={18} className={assessment.iconColor} />
                  </div>
                  {isCompleted && <CheckCircle size={16} className="text-varzea" />}
                </div>
                <h3 className="text-sm font-semibold text-text-primary">{assessment.title}</h3>
                <p className="mt-0.5 text-[11px] text-text-muted">{assessment.description}</p>
                <div className="mt-2">
                  <span className={`text-[10px] font-semibold ${isCompleted ? "text-varzea" : "text-text-muted/50"}`}>
                    {isCompleted ? "Concluída — ver resultado" : "Iniciar"}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Choice Modal: Fazer teste ou Upload */}
      {choiceModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => setChoiceModal(null)} />
          <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-bg-card shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{choiceModal.title}</h3>
              <button type="button" onClick={() => setChoiceModal(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:text-white hover:bg-bg-hover">
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-text-muted">Como deseja registrar sua avaliação?</p>

            <div className="space-y-2">
              <Link
                href={choiceModal.href}
                className="flex items-center gap-3 rounded-xl border border-cerrado-600/20 bg-cerrado-600/5 p-4 text-left transition-all hover:bg-cerrado-600/10"
                onClick={() => setChoiceModal(null)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cerrado-600 text-white">
                  <Play size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Fazer o Teste</p>
                  <p className="text-xs text-text-muted">Responder ao questionário na plataforma</p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => { setChoiceModal(null); setUploadModal(choiceModal) }}
                className="flex w-full items-center gap-3 rounded-xl shadow-card p-4 text-left transition-all hover:bg-bg-hover"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-elevated text-text-muted">
                  <Upload size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Importar Resultado</p>
                  <p className="text-xs text-text-muted">Upload de PDF ou imagem de teste já realizado</p>
                </div>
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Upload Modal */}
      {uploadModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => !uploading && setUploadModal(null)} />
          <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-bg-card shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Importar {uploadModal.title}</h3>
              <button type="button" onClick={() => !uploading && setUploadModal(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:text-white hover:bg-bg-hover">
                <X size={14} />
              </button>
            </div>

            {uploadSuccess ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle size={32} className="mx-auto text-varzea" />
                <p className="text-sm font-medium text-text-primary">Resultado importado!</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-text-muted">
                  Envie um PDF, imagem ou screenshot do resultado do seu teste de {uploadModal.title}.
                  A IA irá extrair os scores automaticamente.
                </p>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(uploadModal, file)
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border-medium p-8 transition-all hover:border-cerrado-600/30 hover:bg-cerrado-600/5"
                >
                  {uploading ? (
                    <>
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cerrado-600 border-t-transparent" />
                      <p className="text-sm text-text-muted">Analisando com IA...</p>
                    </>
                  ) : (
                    <>
                      <FileUp size={28} className="text-text-muted" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-text-primary">Clique para selecionar</p>
                        <p className="text-xs text-text-muted">PDF, PNG, JPG — max 10MB</p>
                      </div>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* Section 2: Perfil Implícito */}
      <ImplicitProfileSection profile={learnerProfile} />

      {/* Section 3 & 4: Assessment Charts */}
      {(bigFiveResult || discResult) && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {bigFiveResult && <BigFiveSection result={bigFiveResult} />}
          {discResult && <DISCSection result={discResult} />}
        </div>
      )}

      {/* Section 5: Insights */}
      <InsightsSection
        learnerProfile={learnerProfile}
        bigFive={bigFiveResult}
        disc={discResult}
      />
    </div>
  )
}

function ImplicitProfileSection({ profile }: { profile: LearnerProfile | null }) {
  if (!profile) {
    return (
      <div className="rounded-2xl shadow-card bg-bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-cerrado-600" />
          <h3 className="text-sm font-semibold text-text-primary">Perfil Implícito</h3>
        </div>
        <div className="text-center py-4">
          <Brain className="mx-auto mb-2 h-8 w-8 text-text-muted/40" />
          <p className="text-sm text-text-muted">
            Será construído conforme você usa a plataforma.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl shadow-card bg-bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-cerrado-600" />
        <h3 className="text-sm font-semibold text-text-primary">Perfil Implícito</h3>
        <span className="text-[10px] text-text-muted">({profile.sessionCount} sessões analisadas)</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {profile.kolbDominantStyle && (
          <div className="rounded-xl bg-bg-surface shadow-card p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">Kolb</p>
            <p className="text-sm font-bold text-text-primary capitalize">{profile.kolbDominantStyle}</p>
          </div>
        )}
        {profile.engagementStyle && (
          <div className="rounded-xl bg-bg-surface shadow-card p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">Engajamento</p>
            <p className="text-sm font-bold text-text-primary capitalize">{profile.engagementStyle}</p>
          </div>
        )}
        {profile.reasoningStyle && (
          <div className="rounded-xl bg-bg-surface shadow-card p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">Raciocínio</p>
            <p className="text-sm font-bold text-text-primary capitalize">{profile.reasoningStyle}</p>
          </div>
        )}
        {profile.detailOrientation && (
          <div className="rounded-xl bg-bg-surface shadow-card p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">Detalhe</p>
            <p className="text-sm font-bold text-text-primary capitalize">{profile.detailOrientation}</p>
          </div>
        )}
      </div>

      {profile.summary && (
        <p className="text-sm text-text-secondary leading-relaxed rounded-xl bg-bg-surface p-4">{profile.summary}</p>
      )}
    </div>
  )
}

function BigFiveSection({ result }: { result: BigFiveResult }) {
  const chartData = Object.entries(BIG_FIVE_LABELS).map(([key, label]) => ({
    subject: label,
    score: result[key as keyof BigFiveResult],
    fullMark: 100,
  }))

  return (
    <div className="rounded-2xl shadow-card bg-bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-accent-gold" />
        <h3 className="text-sm font-semibold text-text-primary">Big Five</h3>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
          <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke="var(--color-accent-gold,#d4a853)" fill="var(--color-accent-gold,#d4a853)" fillOpacity={0.2} />
          <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} />
        </RadarChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1.5">
        {Object.entries(BIG_FIVE_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-text-muted">{label}</span>
            <span className="font-bold text-text-primary">{result[key as keyof BigFiveResult]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DISCSection({ result }: { result: DISCResult }) {
  const chartData = [
    { subject: "Dominância", score: result.d },
    { subject: "Influência", score: result.i },
    { subject: "Estabilidade", score: result.s },
    { subject: "Conformidade", score: result.c },
  ]

  const dominantKey = result.dominantType ?? "D"
  const dominantInfo = DISC_LABELS[dominantKey]

  return (
    <div className="rounded-2xl shadow-card bg-bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-cerrado-600" />
          <h3 className="text-sm font-semibold text-text-primary">DISC</h3>
        </div>
        {dominantInfo && (
          <Badge variant="info" className="text-[10px]">{dominantInfo.label}</Badge>
        )}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
          <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke="var(--color-cerrado-600,#2a6ab0)" fill="var(--color-cerrado-600,#2a6ab0)" fillOpacity={0.2} />
          <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} />
        </RadarChart>
      </ResponsiveContainer>
      {dominantInfo && (
        <p className="mt-3 text-xs text-text-muted rounded-xl bg-bg-surface p-3">
          <strong className="text-text-primary">{dominantInfo.label}:</strong> {dominantInfo.description}
        </p>
      )}
    </div>
  )
}

function InsightsSection({
  learnerProfile,
  bigFive,
  disc,
}: {
  learnerProfile: LearnerProfile | null
  bigFive: BigFiveResult | null
  disc: DISCResult | null
}) {
  const insights: string[] = []

  if (bigFive) {
    if (bigFive.openness >= 70) insights.push("Sua alta abertura indica engajamento com conteúdos variados e abordagens criativas.")
    if (bigFive.conscientiousness >= 70) insights.push("Sua organização favorece checklists e metas claras para cada sessão de estudo.")
    if (bigFive.extraversion >= 70) insights.push("Atividades interativas e discussões em grupo potencializam seu aprendizado.")
  }

  if (disc) {
    const max = Math.max(disc.d, disc.i, disc.s, disc.c)
    if (disc.d === max) insights.push("Desafios diretos e mensuráveis motivam seu aprendizado.")
    if (disc.s === max) insights.push("Um ritmo consistente com revisões periódicas potencializa seu aprendizado.")
  }

  if (learnerProfile?.strengths?.length) {
    insights.push(`Pontos fortes: ${learnerProfile.strengths.slice(0, 3).join(", ")}.`)
  }

  if (!insights.length) return null

  return (
    <div className="rounded-2xl shadow-card bg-bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-accent-gold" />
        <h3 className="text-sm font-semibold text-text-primary">Insights de Aprendizado</h3>
      </div>
      <div className="space-y-2.5">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-gold/10 text-[9px] font-bold text-accent-gold">
              {i + 1}
            </span>
            <p className="text-sm text-text-secondary leading-relaxed">{insight}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
