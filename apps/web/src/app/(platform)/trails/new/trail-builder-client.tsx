"use client"

import { useRouter } from "next/navigation"
import { Button, Card, CardContent, Input, Select, Textarea, Toggle } from "@eximia/ui"
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Trash2,
  X,
} from "lucide-react"
import { useState, useTransition } from "react"
import { createTrail } from "../actions"

interface Course {
  id: string
  title: string
  status: string
}

interface JobRole {
  id: string
  name: string
  seniority_level: string
}

interface SelectedCourse {
  course_id: string
  title: string
  order: number
  is_required: boolean
  estimated_hours: number | null
}

export function TrailBuilderClient({
  courses,
  jobRoles,
}: {
  courses: Course[]
  jobRoles: JobRole[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(1)
  const [error, setError] = useState("")

  // Step 1: Trail info
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [targetRoleId, setTargetRoleId] = useState("")
  const [isMandatory, setIsMandatory] = useState(false)

  // Step 2: Course selection
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([])
  const [searchTerm, setSearchTerm] = useState("")

  const filteredCourses = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !selectedCourses.some((sc) => sc.course_id === c.id),
  )

  function addCourse(course: Course) {
    setSelectedCourses((prev) => [
      ...prev,
      {
        course_id: course.id,
        title: course.title,
        order: prev.length,
        is_required: true,
        estimated_hours: null,
      },
    ])
  }

  function removeCourse(courseId: string) {
    setSelectedCourses((prev) =>
      prev.filter((c) => c.course_id !== courseId).map((c, i) => ({ ...c, order: i })),
    )
  }

  function moveCourse(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= selectedCourses.length) return

    setSelectedCourses((prev) => {
      const updated = [...prev]
      const temp = updated[index]
      updated[index] = updated[newIndex]
      updated[newIndex] = temp
      return updated.map((c, i) => ({ ...c, order: i }))
    })
  }

  function toggleRequired(courseId: string) {
    setSelectedCourses((prev) =>
      prev.map((c) => (c.course_id === courseId ? { ...c, is_required: !c.is_required } : c)),
    )
  }

  function setHours(courseId: string, hours: string) {
    const parsed = hours ? Number.parseInt(hours, 10) : null
    setSelectedCourses((prev) =>
      prev.map((c) => (c.course_id === courseId ? { ...c, estimated_hours: parsed } : c)),
    )
  }

  function handleSubmit() {
    setError("")

    if (!title.trim()) {
      setError("Título é obrigatório")
      return
    }
    if (selectedCourses.length === 0) {
      setError("Selecione pelo menos 1 curso")
      return
    }

    startTransition(async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        target_job_role_id: targetRoleId || null,
        is_mandatory: isMandatory,
        courses: selectedCourses.map((c) => ({
          course_id: c.course_id,
          order: c.order,
          is_required: c.is_required,
          estimated_hours: c.estimated_hours,
        })),
      }

      const result = await createTrail(payload)
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }

      router.push("/trails")
    })
  }

  return (
    <div className="max-w-3xl">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                s === step
                  ? "bg-accent-blue-mid text-white"
                  : s < step
                    ? "bg-semantic-success text-white"
                    : "bg-bg-card text-text-secondary"
              }`}
            >
              {s}
            </div>
            <span className="text-sm text-text-secondary">
              {s === 1 ? "Informações" : s === 2 ? "Cursos" : "Preview"}
            </span>
            {s < 3 && <ChevronRight className="h-4 w-4 text-text-secondary" />}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-semantic-error bg-semantic-error/10 rounded-md p-3 mb-4">
          {error}
        </p>
      )}

      {/* Step 1: Trail info */}
      {step === 1 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <label
                htmlFor="trail-title"
                className="block text-sm font-medium text-text-primary mb-1"
              >
                Título
              </label>
              <Input
                id="trail-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Trilha de Análise de Dados"
              />
            </div>
            <div>
              <label
                htmlFor="trail-description"
                className="block text-sm font-medium text-text-primary mb-1"
              >
                Descrição
              </label>
              <Textarea
                id="trail-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição da trilha (opcional)"
              />
            </div>
            <div>
              <label
                htmlFor="trail-target-role"
                className="block text-sm font-medium text-text-primary mb-1"
              >
                Cargo alvo
              </label>
              <Select
                id="trail-target-role"
                value={targetRoleId}
                onChange={(e) => setTargetRoleId(e.target.value)}
              >
                <option value="">Nenhum cargo específico</option>
                {jobRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.seniority_level})
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Toggle
                checked={isMandatory}
                onCheckedChange={setIsMandatory}
                aria-label="Trilha obrigatória"
              />
              <span className="text-sm text-text-primary">Trilha obrigatória</span>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!title.trim()}>
                Próximo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Course selection */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h3 className="font-medium text-text-primary mb-3">Cursos disponíveis</h3>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar cursos..."
                className="mb-3"
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredCourses.length === 0 ? (
                  <p className="text-sm text-text-secondary py-2">
                    {courses.length === 0 ? "Nenhum curso disponível" : "Nenhum curso encontrado"}
                  </p>
                ) : (
                  filteredCourses.map((course) => (
                    <button
                      type="button"
                      key={course.id}
                      onClick={() => addCourse(course)}
                      className="w-full flex items-center justify-between p-2 rounded-md hover:bg-bg-card text-left text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-text-secondary" />
                        {course.title}
                      </span>
                      <span className="text-xs text-text-secondary">{course.status}</span>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-medium text-text-primary mb-3">
                Cursos na trilha ({selectedCourses.length})
              </h3>
              {selectedCourses.length === 0 ? (
                <p className="text-sm text-text-secondary py-4 text-center">
                  Clique nos cursos acima para adicionar
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedCourses.map((course, index) => (
                    <div
                      key={course.course_id}
                      className="flex items-center gap-2 p-3 rounded-md border border-border-medium bg-bg-surface"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-blue-mid text-white flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {course.title}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <label className="flex items-center gap-1 text-xs text-text-secondary">
                            <Toggle
                              checked={course.is_required}
                              onCheckedChange={() => toggleRequired(course.course_id)}
                              aria-label="Obrigatório"
                            />
                            Obrigatório
                          </label>
                          <label className="flex items-center gap-1 text-xs text-text-secondary">
                            Horas:
                            <input
                              type="number"
                              min="1"
                              className="w-16 rounded border border-border-medium bg-bg-surface px-1.5 py-0.5 text-xs"
                              value={course.estimated_hours ?? ""}
                              onChange={(e) => setHours(course.course_id, e.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => moveCourse(index, "up")}
                          disabled={index === 0}
                          className="p-0.5 rounded hover:bg-bg-card disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCourse(index, "down")}
                          disabled={index === selectedCourses.length - 1}
                          className="p-0.5 rounded hover:bg-bg-card disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCourse(course.course_id)}
                        className="p-1 rounded hover:bg-semantic-error/10"
                      >
                        <X className="h-4 w-4 text-semantic-error" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={() => setStep(3)} disabled={selectedCourses.length === 0}>
              Preview
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
              {description && <p className="text-sm text-text-secondary">{description}</p>}

              <div className="flex items-center gap-4 text-sm text-text-secondary">
                <span>{selectedCourses.length} cursos</span>
                {isMandatory && (
                  <span className="text-semantic-error font-medium">Obrigatória</span>
                )}
                {targetRoleId && (
                  <span>Cargo: {jobRoles.find((r) => r.id === targetRoleId)?.name ?? "—"}</span>
                )}
              </div>

              <div className="space-y-2 mt-4">
                {selectedCourses.map((course, index) => (
                  <div key={course.course_id} className="flex items-center gap-3">
                    {index > 0 && (
                      <div className="w-6 flex justify-center -my-2">
                        <div className="w-0.5 h-4 bg-border-default" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 flex-1 p-3 rounded-md border border-border-medium">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-blue-mid text-white flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">{course.title}</p>
                        <div className="flex gap-2 text-xs text-text-secondary mt-0.5">
                          <span>{course.is_required ? "Obrigatório" : "Opcional"}</span>
                          {course.estimated_hours && <span>{course.estimated_hours}h</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Editar Cursos
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Criando..." : "Criar Trilha"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
