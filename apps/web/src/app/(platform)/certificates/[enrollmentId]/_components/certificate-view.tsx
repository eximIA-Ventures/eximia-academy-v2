"use client"

import { Button } from "@eximia/ui"
import { ArrowLeft, Download } from "lucide-react"
import Link from "next/link"
import { QRCodeCanvas } from "./qr-code-canvas"

interface Certificate {
  id: string
  student_name: string
  course_title: string
  instructor_name: string | null
  workload_hours: number | null
  issued_at: string
  verification_code: string
  course_id: string
}

interface CertificateViewProps {
  certificate: Certificate
  brandName: string
  brandLogo: string
  partnerName?: string
  partnerLogo?: string
  primaryColor: string
  accentColor: string
}

export function CertificateView({
  certificate,
  brandName,
  brandLogo,
  partnerName,
  partnerLogo,
  primaryColor,
  accentColor,
}: CertificateViewProps) {
  const issuedDate = new Date(certificate.issued_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${certificate.verification_code}`
      : `/verify/${certificate.verification_code}`

  function handlePrint() {
    window.print()
  }

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          /* Hide everything except the certificate */
          body * { visibility: hidden; }
          #certificate-printable, #certificate-printable * { visibility: visible; }
          #certificate-printable {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
          }
          /* Hide the action bar in print */
          #certificate-actions { display: none !important; }
          /* Hide sidebar and header */
          nav, header, aside, footer { display: none !important; }
        }
        @page {
          size: A4 landscape;
          margin: 0;
        }
      `}</style>

      {/* Action bar — hidden in print */}
      <div id="certificate-actions" className="mb-6 flex items-center justify-between">
        <Link href={`/courses/${certificate.course_id}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft size={14} />
            Voltar ao curso
          </Button>
        </Link>
        <Button onClick={handlePrint} size="sm" className="gap-2">
          <Download size={14} />
          Baixar PDF
        </Button>
      </div>

      {/* Certificate — printable area */}
      <div
        id="certificate-printable"
        className="relative mx-auto aspect-[1.414/1] max-w-4xl overflow-hidden rounded-lg bg-white shadow-elevated print:rounded-none print:shadow-none"
      >
        {/* Decorative border */}
        <div
          className="absolute inset-3 rounded-sm border-2"
          style={{ borderColor: accentColor }}
        />
        <div
          className="absolute inset-5 rounded-sm border"
          style={{ borderColor: `${accentColor}40` }}
        />

        {/* Corner ornaments */}
        <CornerOrnament position="top-left" color={primaryColor} />
        <CornerOrnament position="top-right" color={primaryColor} />
        <CornerOrnament position="bottom-left" color={primaryColor} />
        <CornerOrnament position="bottom-right" color={primaryColor} />

        {/* Content */}
        <div className="relative flex h-full flex-col items-center justify-between px-16 py-12">
          {/* Header logos */}
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brandLogo} alt={brandName} className="h-10 w-auto object-contain" />
            </div>
            {partnerLogo && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">Powered by</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={partnerLogo}
                  alt={partnerName ?? ""}
                  className="h-7 w-auto object-contain"
                />
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">
              Certificado de Conclusao
            </p>

            <div className="mt-4 h-px w-24" style={{ backgroundColor: accentColor }} />

            <p className="mt-6 text-sm text-gray-500">Certificamos que</p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ color: primaryColor }}>
              {certificate.student_name}
            </h1>

            <p className="mt-5 max-w-lg text-sm leading-relaxed text-gray-500">
              concluiu com exito o curso
            </p>

            <h2 className="mt-2 text-xl font-semibold text-gray-800">{certificate.course_title}</h2>

            {certificate.workload_hours && (
              <p className="mt-3 text-sm text-gray-500">
                com carga horaria de{" "}
                <span className="font-medium text-gray-700">
                  {certificate.workload_hours} horas
                </span>
              </p>
            )}

            <p className="mt-2 text-sm text-gray-500">em {issuedDate}</p>
          </div>

          {/* Footer: instructor + QR + verification */}
          <div className="flex w-full items-end justify-between">
            {/* Instructor signature area */}
            <div className="flex flex-col items-center">
              <div className="mb-2 h-px w-48 bg-gray-300" />
              <p className="text-sm font-medium text-gray-700">
                {certificate.instructor_name ?? brandName}
              </p>
              <p className="text-xs text-gray-400">
                {certificate.instructor_name ? "Instrutor(a)" : "Instituicao"}
              </p>
            </div>

            {/* QR Code + verification */}
            <div className="flex flex-col items-center gap-2">
              <QRCodeCanvas value={verifyUrl} size={64} />
              <p className="text-[9px] text-gray-400">
                Verifique: {certificate.verification_code.slice(0, 8)}...
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* Corner ornament SVG */
function CornerOrnament({ position, color }: { position: string; color: string }) {
  const transforms: Record<string, string> = {
    "top-left": "",
    "top-right": "scale(-1, 1)",
    "bottom-left": "scale(1, -1)",
    "bottom-right": "scale(-1, -1)",
  }

  const positions: Record<string, string> = {
    "top-left": "left-4 top-4",
    "top-right": "right-4 top-4",
    "bottom-left": "left-4 bottom-4",
    "bottom-right": "right-4 bottom-4",
  }

  return (
    <svg
      className={`absolute ${positions[position]} h-8 w-8`}
      viewBox="0 0 32 32"
      style={{ transform: transforms[position] }}
    >
      <path d="M0 0 L12 0 L12 2 L2 2 L2 12 L0 12 Z" fill={color} opacity="0.6" />
      <path d="M0 0 L6 0 L6 1 L1 1 L1 6 L0 6 Z" fill={color} opacity="0.3" />
    </svg>
  )
}
