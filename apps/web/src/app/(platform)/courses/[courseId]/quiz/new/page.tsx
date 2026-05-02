import { QuizWizard } from "../_components/quiz-wizard"

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function NewQuizPage({ params }: PageProps) {
  const { courseId } = await params

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Criar Quiz</h1>
        <p className="text-sm text-text-secondary">
          Configure um novo quiz para avaliar os alunos deste curso.
        </p>
      </div>
      <QuizWizard courseId={courseId} />
    </div>
  )
}
