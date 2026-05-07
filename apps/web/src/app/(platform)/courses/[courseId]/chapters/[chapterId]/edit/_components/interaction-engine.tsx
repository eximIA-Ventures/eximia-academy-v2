"use client"

import { Button, useToast } from "@eximia/ui"
import {
  Bot,
  CheckCircle,
  ClipboardList,
  FileText,
  Loader2,
  MessageCircle,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  X,
} from "lucide-react"
import { useCallback, useState } from "react"

type InteractionMode = "quiz" | "scenario" | "assignment" | "socratic_dialogue" | null

interface QuizQuestion {
  id: string
  text: string
  question_type: "multiple_choice" | "true_false" | "open_ended"
  options: string[]
  correct_answer: string
  explanation: string
  skill: string
}

interface ScenarioConfig {
  title: string
  company: string
  context: string
  problem: string
  data: string[]
  steps: Array<{ id: string; title: string; icon: string; prompt: string; hint: string }>
}

interface AssignmentConfig {
  title: string
  description: string
  instructions: string[]
  deliverable: string
  estimatedTime: string
  rubric: Array<{ id: string; name: string; description: string; maxScore: number }>
}

interface InteractionEngineProps {
  chapterId: string
  currentMode: InteractionMode
  currentQuestions: QuizQuestion[]
  currentScenario: ScenarioConfig | null
  currentAssignment: AssignmentConfig | null
  onModeChange: (mode: InteractionMode) => void
  onQuestionsChange: (questions: QuizQuestion[]) => void
  onScenarioChange: (scenario: ScenarioConfig | null) => void
  onAssignmentChange: (assignment: AssignmentConfig | null) => void
}

const MODES = [
  { key: "quiz" as const, label: "Quiz", icon: ClipboardList, color: "cerrado-600", desc: "Múltipla escolha, V/F, dissertativa" },
  { key: "scenario" as const, label: "Cenário", icon: Target, color: "amber-500", desc: "Caso real para resolução guiada" },
  { key: "assignment" as const, label: "Atividade", icon: FileText, color: "purple-500", desc: "Entrega avaliada com rubrica" },
  { key: "socratic_dialogue" as const, label: "Socrático", icon: MessageCircle, color: "varzea", desc: "Diálogo reflexivo com IA" },
]

export function InteractionEngine({
  chapterId,
  currentMode,
  currentQuestions,
  currentScenario,
  currentAssignment,
  onModeChange,
  onQuestionsChange,
  onScenarioChange,
  onAssignmentChange,
}: InteractionEngineProps) {
  const { toast } = useToast()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-accent-gold" />
        <label className="text-sm font-semibold text-text-primary">Interação do Capítulo</label>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODES.map((mode) => {
          const Icon = mode.icon
          const isActive = currentMode === mode.key

          return (
            <button
              key={mode.key}
              type="button"
              onClick={() => onModeChange(isActive ? null : mode.key)}
              className={`flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all ${
                isActive
                  ? `bg-${mode.color}/10 ring-2 ring-${mode.color}/40 text-${mode.color}`
                  : "bg-bg-surface shadow-card text-text-muted  hover:bg-bg-hover"
              }`}
            >
              <Icon size={20} />
              <span className="text-xs font-semibold">{mode.label}</span>
              <span className="text-[9px] opacity-60">{mode.desc}</span>
            </button>
          )
        })}
      </div>

      {/* Mode-specific builder */}
      {currentMode === "quiz" && (
        <QuizBuilder
          chapterId={chapterId}
          questions={currentQuestions}
          onChange={onQuestionsChange}
        />
      )}

      {currentMode === "scenario" && (
        <ScenarioBuilder
          chapterId={chapterId}
          scenario={currentScenario}
          onChange={onScenarioChange}
        />
      )}

      {currentMode === "assignment" && (
        <AssignmentBuilder
          assignment={currentAssignment}
          onChange={onAssignmentChange}
        />
      )}

      {currentMode === "socratic_dialogue" && (
        <div className="rounded-xl bg-varzea/5 ring-1 ring-varzea/20 p-4 text-center">
          <MessageCircle size={24} className="mx-auto text-varzea mb-2" />
          <p className="text-sm text-text-primary font-medium">Diálogo Socrático</p>
          <p className="text-xs text-text-muted mt-1">
            As perguntas-gatilho para o diálogo são gerenciadas na aba de Perguntas do capítulo.
          </p>
        </div>
      )}

      {!currentMode && (
        <div className="rounded-xl bg-bg-surface shadow-card p-6 text-center">
          <p className="text-sm text-text-muted">Selecione um modo de interação para este capítulo.</p>
          <p className="text-xs text-text-muted/60 mt-1">O aluno verá a interação ao final do conteúdo do slide/texto.</p>
        </div>
      )}
    </div>
  )
}

/* ═══ QUIZ BUILDER ═══ */

function QuizBuilder({
  chapterId,
  questions,
  onChange,
}: {
  chapterId: string
  questions: QuizQuestion[]
  onChange: (q: QuizQuestion[]) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)

  function addQuestion(type: "multiple_choice" | "true_false" | "open_ended") {
    const id = crypto.randomUUID()
    const newQ: QuizQuestion = {
      id,
      text: "",
      question_type: type,
      options: type === "multiple_choice" ? ["", "", "", ""] : type === "true_false" ? ["Verdadeiro", "Falso"] : [],
      correct_answer: "",
      explanation: "",
      skill: "aplicacao",
    }
    onChange([...questions, newQ])
    setEditing(id)
  }

  function updateQuestion(id: string, updates: Partial<QuizQuestion>) {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)))
  }

  function removeQuestion(id: string) {
    onChange(questions.filter((q) => q.id !== id))
    if (editing === id) setEditing(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-muted">{questions.length} questões</span>
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => addQuestion("multiple_choice")}>
            <Plus size={12} className="mr-1" /> Múltipla Escolha
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addQuestion("true_false")}>
            <Plus size={12} className="mr-1" /> V/F
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addQuestion("open_ended")}>
            <Plus size={12} className="mr-1" /> Dissertativa
          </Button>
        </div>
      </div>

      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl shadow-card bg-bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cerrado-600/15 text-[10px] font-bold text-cerrado-600">
                {i + 1}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {q.question_type === "multiple_choice" ? "Múltipla Escolha" : q.question_type === "true_false" ? "Verdadeiro/Falso" : "Dissertativa"}
              </span>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => setEditing(editing === q.id ? null : q.id)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary">
                {editing === q.id ? <X size={14} /> : <ClipboardList size={14} />}
              </button>
              <button type="button" onClick={() => removeQuestion(q.id)} className="rounded-lg p-1.5 text-text-muted hover:bg-semantic-error/10 hover:text-semantic-error">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <input
            type="text"
            value={q.text}
            onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
            placeholder="Digite a pergunta..."
            className="w-full rounded-lg shadow-card bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-cerrado-600/40 focus:outline-none"
          />

          {editing === q.id && (
            <div className="space-y-2 pt-1">
              {q.question_type === "multiple_choice" && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Opções (marque a correta)</p>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuestion(q.id, { correct_answer: opt })}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                          q.correct_answer === opt && opt
                            ? "border-semantic-success bg-semantic-success text-white"
                            : "border-border-medium"
                        }`}
                      >
                        {q.correct_answer === opt && opt && <CheckCircle size={12} />}
                      </button>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...q.options]
                          newOpts[oi] = e.target.value
                          updateQuestion(q.id, { options: newOpts })
                        }}
                        placeholder={`Opção ${String.fromCharCode(65 + oi)}`}
                        className="flex-1 rounded-lg shadow-card bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-cerrado-600/40 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}

              {q.question_type === "true_false" && (
                <div className="flex gap-2">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mr-2">Resposta correta:</p>
                  {["true", "false"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => updateQuestion(q.id, { correct_answer: v })}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                        q.correct_answer === v
                          ? "bg-semantic-success/15 text-semantic-success ring-1 ring-semantic-success/30"
                          : "bg-bg-surface text-text-muted shadow-card"
                      }`}
                    >
                      {v === "true" ? "Verdadeiro" : "Falso"}
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={q.explanation}
                onChange={(e) => updateQuestion(q.id, { explanation: e.target.value })}
                placeholder="Explicação (mostrada após responder)"
                className="w-full rounded-lg shadow-card bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-cerrado-600/40 focus:outline-none"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ═══ SCENARIO BUILDER (with AI generation) ═══ */

function ScenarioBuilder({
  chapterId,
  scenario,
  onChange,
}: {
  chapterId: string
  scenario: ScenarioConfig | null
  onChange: (s: ScenarioConfig | null) => void
}) {
  const [generating, setGenerating] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const { toast } = useToast()

  async function generateWithAI() {
    if (!aiPrompt.trim()) {
      toast({ variant: "error", title: "Descreva o cenário que deseja gerar" })
      return
    }

    setGenerating(true)
    try {
      const res = await fetch("/api/chapters/generate-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, chapterId }),
      })
      const data = await res.json()

      if (res.ok && data.scenario) {
        onChange(data.scenario)
        toast({ variant: "success", title: "Cenário gerado! Revise e ajuste." })
      } else {
        toast({ variant: "error", title: data.error ?? "Erro ao gerar cenário" })
      }
    } catch {
      toast({ variant: "error", title: "Erro de conexão" })
    } finally {
      setGenerating(false)
    }
  }

  if (!scenario) {
    return (
      <div className="rounded-xl bg-amber-500/5 ring-1 ring-amber-500/20 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wand2 size={16} className="text-amber-500" />
          <p className="text-sm font-semibold text-text-primary">Gerador de Cenários com IA</p>
        </div>
        <p className="text-xs text-text-muted">Descreva o problema/situação e a IA gerará um cenário completo com dados, etapas guiadas e critérios de avaliação.</p>
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          rows={3}
          placeholder="Ex: Problema de qualidade na linha de embalagem de chocolates, com paradas frequentes e alto custo de manutenção..."
          className="w-full rounded-xl shadow-card bg-bg-primary p-3 text-sm text-text-primary placeholder:text-text-muted focus:border-amber-500/40 focus:outline-none resize-y"
        />
        <div className="flex gap-2">
          <Button type="button" onClick={generateWithAI} disabled={generating || !aiPrompt.trim()}>
            {generating ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Sparkles size={14} className="mr-1.5" />}
            {generating ? "Gerando..." : "Gerar Cenário com IA"}
          </Button>
          <Button type="button" variant="outline" onClick={() => onChange({
            title: "", company: "", context: "", problem: "", data: [],
            steps: [
              { id: "s1", title: "Identificar o Problema", icon: "search", prompt: "", hint: "" },
              { id: "s2", title: "Análise de Causas", icon: "target", prompt: "", hint: "" },
              { id: "s3", title: "Propor Soluções", icon: "lightbulb", prompt: "", hint: "" },
              { id: "s4", title: "Plano de Ação", icon: "clipboard", prompt: "", hint: "" },
            ],
          })}>
            Criar Manualmente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl ring-1 ring-amber-500/20 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-amber-500" />
          <p className="text-sm font-semibold text-text-primary">Cenário Configurado</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-xs text-semantic-error hover:underline">
          Remover
        </button>
      </div>

      <input type="text" value={scenario.title} onChange={(e) => onChange({ ...scenario, title: e.target.value })}
        placeholder="Título do cenário" className="w-full rounded-lg shadow-card bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary focus:border-amber-500/40 focus:outline-none" />
      <input type="text" value={scenario.company} onChange={(e) => onChange({ ...scenario, company: e.target.value })}
        placeholder="Empresa" className="w-full rounded-lg shadow-card bg-bg-primary px-3 py-1.5 text-xs text-text-primary focus:outline-none" />
      <textarea value={scenario.context} onChange={(e) => onChange({ ...scenario, context: e.target.value })}
        placeholder="Contexto" rows={2} className="w-full rounded-lg shadow-card bg-bg-primary px-3 py-1.5 text-xs text-text-primary resize-y focus:outline-none" />
      <textarea value={scenario.problem} onChange={(e) => onChange({ ...scenario, problem: e.target.value })}
        placeholder="Problema" rows={2} className="w-full rounded-lg shadow-card bg-bg-primary px-3 py-1.5 text-xs text-text-primary resize-y focus:outline-none" />

      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{scenario.steps.length} etapas configuradas</p>
    </div>
  )
}

/* ═══ ASSIGNMENT BUILDER ═══ */

function AssignmentBuilder({
  assignment,
  onChange,
}: {
  assignment: AssignmentConfig | null
  onChange: (a: AssignmentConfig | null) => void
}) {
  if (!assignment) {
    return (
      <div className="rounded-xl bg-purple-500/5 ring-1 ring-purple-500/20 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-purple-400" />
          <p className="text-sm font-semibold text-text-primary">Configurar Atividade</p>
        </div>
        <p className="text-xs text-text-muted">Crie uma atividade com instruções, entregável e rubrica de avaliação.</p>
        <Button type="button" variant="outline" onClick={() => onChange({
          title: "", description: "", instructions: [""], deliverable: "", estimatedTime: "30 minutos",
          rubric: [{ id: "r1", name: "Critério 1", description: "", maxScore: 25 }],
        })}>
          <Plus size={14} className="mr-1.5" /> Criar Atividade
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-xl ring-1 ring-purple-500/20 bg-purple-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-purple-400" />
          <p className="text-sm font-semibold text-text-primary">Atividade Configurada</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-xs text-semantic-error hover:underline">
          Remover
        </button>
      </div>

      <input type="text" value={assignment.title} onChange={(e) => onChange({ ...assignment, title: e.target.value })}
        placeholder="Título da atividade" className="w-full rounded-lg shadow-card bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary focus:border-purple-500/40 focus:outline-none" />
      <textarea value={assignment.description} onChange={(e) => onChange({ ...assignment, description: e.target.value })}
        placeholder="Descrição" rows={2} className="w-full rounded-lg shadow-card bg-bg-primary px-3 py-1.5 text-xs text-text-primary resize-y focus:outline-none" />
      <input type="text" value={assignment.deliverable} onChange={(e) => onChange({ ...assignment, deliverable: e.target.value })}
        placeholder="Entregável esperado" className="w-full rounded-lg shadow-card bg-bg-primary px-3 py-1.5 text-xs text-text-primary focus:outline-none" />

      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Rubrica ({assignment.rubric.length} critérios)</p>
        {assignment.rubric.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <input type="text" value={c.name} onChange={(e) => {
              const newRubric = [...assignment.rubric]
              newRubric[i] = { ...c, name: e.target.value }
              onChange({ ...assignment, rubric: newRubric })
            }} placeholder="Nome do critério" className="flex-1 rounded-lg shadow-card bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none" />
            <input type="number" value={c.maxScore} onChange={(e) => {
              const newRubric = [...assignment.rubric]
              newRubric[i] = { ...c, maxScore: Number(e.target.value) }
              onChange({ ...assignment, rubric: newRubric })
            }} className="w-16 rounded-lg shadow-card bg-bg-primary px-2 py-1 text-xs text-text-primary text-center focus:outline-none" />
            <span className="text-[10px] text-text-muted">pts</span>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange({
          ...assignment,
          rubric: [...assignment.rubric, { id: crypto.randomUUID(), name: "", description: "", maxScore: 25 }],
        })}>
          <Plus size={12} className="mr-1" /> Adicionar Critério
        </Button>
      </div>
    </div>
  )
}
