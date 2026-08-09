import { createClient } from "@/lib/supabase/server"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Verificar Certificado",
  description: "Verifique a autenticidade de um certificado eximIA Academy",
}

interface PageProps {
  params: Promise<{ code: string }>
}

export default async function VerifyCertificatePage({ params }: PageProps) {
  const { code } = await params
  const supabase = await createClient()

  const { data: cert } = await supabase
    .from("certificates")
    .select("student_name, course_title, instructor_name, workload_hours, issued_at, verification_code")
    .eq("verification_code", code)
    .single()

  if (!cert) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Certificado Não Encontrado</h1>
          <p className="text-muted-foreground">
            O código de verificação informado não corresponde a nenhum certificado válido.
          </p>
        </div>
      </div>
    )
  }

  const issuedDate = new Date(cert.issued_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="flex min-h-dvh items-center justify-center p-6 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-lg space-y-6">
        {/* Verification badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-2">
            <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-emerald-600">Certificado Verificado</span>
          </div>
        </div>

        {/* Certificate card */}
        <div className="rounded-2xl border bg-card p-8 shadow-lg space-y-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground uppercase tracking-wider">Certificado de Conclusão</p>
            <h1 className="text-2xl font-bold text-foreground">{cert.course_title}</h1>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b">
              <span className="text-sm text-muted-foreground">Aluno(a)</span>
              <span className="font-medium text-foreground">{cert.student_name}</span>
            </div>

            {cert.instructor_name && (
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-sm text-muted-foreground">Instrutor(a)</span>
                <span className="font-medium text-foreground">{cert.instructor_name}</span>
              </div>
            )}

            <div className="flex justify-between items-center py-3 border-b">
              <span className="text-sm text-muted-foreground">Carga Horária</span>
              <span className="font-medium text-foreground">{cert.workload_hours}h</span>
            </div>

            <div className="flex justify-between items-center py-3 border-b">
              <span className="text-sm text-muted-foreground">Data de Emissão</span>
              <span className="font-medium text-foreground">{issuedDate}</span>
            </div>

            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-muted-foreground">Código</span>
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{cert.verification_code}</code>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Emitido por eximIA Academy — Plataforma de Ensino com IA Socrática
        </p>
      </div>
    </div>
  )
}
