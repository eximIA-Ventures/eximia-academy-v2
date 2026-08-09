import { getAuthProfile } from "@/lib/auth"
import { contextForcesStudentView, resolveContext } from "@/lib/context-resolver"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { ConsciousnessWizardPage } from "./consciousness-wizard-page"

interface ConsciousnessPageProps {
  params: Promise<{ courseId: string }>
}

export default async function ConsciousnessPage({ params }: ConsciousnessPageProps) {
  const { courseId } = await params
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")

  const supabase = await createClient()

  // ROUND 29 (investigação ao vivo, Hugo 2026-07-28: "dá erro ou tela em branco" ao
  // clicar num CTA de "Meu ritmo") — CAUSA RAIZ PROVADA: este gate checava
  // `profile.role` CRU, ignorando `viewAsStudent`/o contexto ativo. As DUAS páginas
  // que redirecionam PARA cá (chapters/[chapterId]/page.tsx e courses/[courseId]/
  // page.tsx) já reconhecem corretamente um manager/instructor/admin/super_admin
  // NAVEGANDO COMO ALUNO (cookie `x-view-as-student` ou contexto `personal` ativo,
  // `contextForcesStudentView`) e o mandam para cá, precisamente porque ele tem
  // matrícula ativa sem a fase "pre" de consciência respondida. Este gate, ao
  // checar só `profile.role`, mandava esse MESMO usuário de volta para
  // `/courses/${courseId}` — que por sua vez o reconhece como aluno de novo e
  // manda ELE de volta para cá. LOOP DE REDIRECT infinito entre as duas rotas,
  // sem nenhuma exceção lançada (por isso o log do servidor nunca mostrava erro),
  // que o navegador eventualmente aborta como erro ("dá erro") ou, numa navegação
  // client-side dentro do App Router, deixa o painel vazio a meio caminho ("tela
  // em branco"). Confirmado com dado real: enrollment `ac8bd7d5-...` do Hugo no
  // curso 4711c03e-... está `active`, e `consciousness_responses` para esse
  // enrollment é um array VAZIO (consultado direto via Supabase REST).
  //
  // CORREÇÃO: usar o MESMO par de sinais que `chapters/[chapterId]/page.tsx` já
  // usa para a mesma decisão (`viewAsStudent` + `contextForcesStudentView`), em
  // vez do `profile.role` cru — a pessoa só é tratada como "papel de conteúdo"
  // (pula a consciência) quando NÃO está navegando como aluno por nenhuma das
  // duas vias. Isso fecha o loop: quem chega aqui vindo de um gate que já
  // concluiu "isto é um aluno agora" não é mais mandado de volta como se fosse
  // staff puro.
  const viewAsStudent = (await cookies()).get("x-view-as-student")?.value === "true"
  const contextStudent = contextForcesStudentView(await resolveContext())
  const isContentRole =
    !viewAsStudent &&
    !contextStudent &&
    ["instructor", "manager", "admin", "super_admin"].includes(profile.role)

  if (isContentRole) {
    return redirect(`/courses/${courseId}`)
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, description")
    .eq("id", courseId)
    .maybeSingle()
  if (!course) return notFound()

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", user.id)
    .eq("course_id", courseId)
    .in("status", ["active", "completed"])
    .maybeSingle()
  if (!enrollment) return redirect("/courses")

  const { data: existing } = await supabase
    .from("consciousness_responses")
    .select("id")
    .eq("enrollment_id", enrollment.id)
    .eq("phase", "pre")
    .maybeSingle()
  if (existing) return redirect(`/courses/${courseId}`)

  return (
    <ConsciousnessWizardPage
      courseId={course.id}
      courseTitle={course.title}
      courseDescription={course.description}
    />
  )
}
