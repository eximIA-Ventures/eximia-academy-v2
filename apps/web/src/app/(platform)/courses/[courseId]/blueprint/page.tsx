import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BlueprintViewer } from "./_components/blueprint-viewer"

interface BlueprintPageProps {
  params: Promise<{ courseId: string }>
}

export default async function BlueprintPage({ params }: BlueprintPageProps) {
  const { courseId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  // Fetch blueprint with modules, objectives, and assessments
  const { data: blueprint, error: bpError } = await supabase
    .from("course_blueprints")
    .select("*")
    .eq("id", courseId)
    .single()

  if (bpError || !blueprint) {
    return redirect("/courses")
  }

  const [
    { data: modules },
    { data: objectives },
    { data: assessments },
  ] = await Promise.all([
    supabase
      .from("blueprint_modules")
      .select("*")
      .eq("blueprint_id", courseId)
      .order("order", { ascending: true }),
    supabase
      .from("blueprint_objectives")
      .select("*")
      .eq("blueprint_id", courseId),
    supabase
      .from("blueprint_assessments")
      .select("*")
      .eq("blueprint_id", courseId),
  ])

  // Group objectives by module
  const objectivesByModule = (objectives || []).reduce(
    (acc, obj) => {
      const moduleNum = obj.module_number
      if (!acc[moduleNum]) acc[moduleNum] = []
      acc[moduleNum].push({
        objectiveId: obj.objective_id,
        bloomLevel: obj.bloom_level,
        objectiveStatement: obj.objective_statement,
      })
      return acc
    },
    {} as Record<number, Array<{ objectiveId: string; bloomLevel: string; objectiveStatement: string }>>,
  )

  const mappedModules = (modules || []).map((m) => ({
    id: m.id,
    order: m.order,
    title: m.title,
    description: m.description,
    durationMinutes: m.duration_minutes,
    interactionType: m.interaction_type,
    frameworkStages: (m.framework_stages as Array<{ stage: string; label?: string; durationMinutes?: number }>) || [],
    cognitiveLoad: m.cognitive_load as { chunkSize?: number; level?: string } | null,
    objectives: objectivesByModule[m.order] || [],
  }))

  const mappedAssessments = (assessments || []).map((a) => ({
    id: a.id,
    objectiveId: a.objective_id,
    assessmentType: a.assessment_type,
    timing: a.timing,
    format: a.format,
    kirkpatrickLevel: a.kirkpatrick_level,
  }))

  // Get course title from blueprint data or fallback
  const blueprintData = blueprint.blueprint_data as Record<string, unknown> | null
  const courseTitle =
    (blueprintData?.course_title as string) ||
    `Blueprint #${courseId.slice(0, 8)}`

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <BlueprintViewer
        blueprint={{
          id: blueprint.id,
          courseId: blueprint.course_id,
          status: blueprint.status,
          framework: blueprint.framework,
          primaryFramework: blueprint.primary_framework,
          qualityScore: blueprint.quality_score ? Number(blueprint.quality_score) : null,
          neuroscienceScore: blueprint.neuroscience_score ? Number(blueprint.neuroscience_score) : null,
          qualityVerdict: blueprint.quality_verdict,
          bloomProgression: blueprint.bloom_progression,
          totalObjectives: blueprint.total_objectives,
          totalAssessments: blueprint.total_assessments,
          interactionStrategy: blueprint.interaction_strategy,
          audienceProfile: blueprint.audience_profile as Record<string, unknown> | null,
          generatedAt: blueprint.generated_at,
          version: blueprint.version,
          modules: mappedModules,
          assessments: mappedAssessments,
        }}
        courseTitle={courseTitle}
      />
    </div>
  )
}
