import { getAuthProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getTenantConfig } from "@/lib/tenant"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { CertificateView } from "./_components/certificate-view"

export const metadata: Metadata = {
  title: "Certificado",
  description: "Certificado de conclusao de curso",
}

interface CertificatePageProps {
  params: Promise<{ enrollmentId: string }>
}

export default async function CertificatePage({ params }: CertificatePageProps) {
  const { enrollmentId } = await params
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")

  const supabase = await createClient()
  const config = getTenantConfig()

  // Fetch certificate by enrollment
  const { data: cert } = await supabase
    .from("certificates")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .single()

  if (!cert) {
    // Try to issue it if enrollment is completed
    const { issueCertificate } = await import("@/lib/certificates/generate")
    const result = await issueCertificate(enrollmentId)
    if (!result) return notFound()

    // Re-fetch the full certificate
    const { data: newCert } = await supabase
      .from("certificates")
      .select("*")
      .eq("id", result.id)
      .single()

    if (!newCert) return notFound()

    return (
      <CertificateView
        certificate={newCert}
        brandName={config.brand.name}
        brandLogo={config.brand.logo}
        partnerName={config.brand.partnerName}
        partnerLogo={config.brand.partnerLogo}
        primaryColor={config.brand.primaryColor}
        accentColor={config.brand.accentColor}
      />
    )
  }

  return (
    <CertificateView
      certificate={cert}
      brandName={config.brand.name}
      brandLogo={config.brand.logo}
      partnerName={config.brand.partnerName}
      partnerLogo={config.brand.partnerLogo}
      primaryColor={config.brand.primaryColor}
      accentColor={config.brand.accentColor}
    />
  )
}
