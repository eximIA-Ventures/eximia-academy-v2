import { MolduraAprendizagem } from "@/app/(platform)/analytics/_aprendizagem-time/moldura"
import {
  AGORA_FIXTURE,
  entradaFixturePadroes,
} from "@/components/analytics/aprendizagem-time/fixture"
import { PadroesEvolucaoTab } from "@/components/analytics/aprendizagem-time/padroes-tab"
import { notFound } from "next/navigation"
import { ForceLightTheme } from "../visao-geral/force-light-theme"
import { PreviewShell } from "../visao-geral/preview-shell"
import { carregarPadroesDoBanco } from "./leitura-real"

// ---------------------------------------------------------------------------
// /gauntlet-preview/aprendizagem-padroes-evolucao — harness visual DEV-ONLY da
// Tela 2 (Padrões e Evolução). Mesmo contrato de `../aprendizagem-visao-
// geral/page.tsx`: `?fonte=fixture|motor`, tema light forçado, 404 em
// produção, `PreviewShell`/`ForceLightTheme` importados, não copiados.
//
// Screenshot: GAUNTLET_ROTA=aprendizagem-padroes-evolucao node scripts/gauntlet-shot.mjs out.png
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic"

const DESTINO_INERTE = {
  pathname: "/gauntlet-preview/aprendizagem-padroes-evolucao",
  query: "fonte=fixture",
}
const CONTROLES_INERTES = {
  periodoDias: 30 as const,
  escopoEquipe: "diretos" as const,
  escopoEditavel: true,
  cursoId: null,
  cursos: [{ id: "curso-1", titulo: "Análise e Solução de Problemas" }],
  falhaCursos: false,
}

const LIGHT_TOKENS = `
:root {
  color-scheme: light;
  --color-bg-app: oklch(0.97 0.005 60);
  --color-bg-sidebar: oklch(0.95 0.005 55);
  --color-bg-surface: oklch(0.98 0.003 55);
  --color-bg-card: oklch(1.0 0 0);
  --color-bg-elevated: oklch(0.96 0.003 55);
  --color-bg-hover: oklch(0.93 0.005 50);
  --color-text-primary: oklch(0.15 0.006 30);
  --color-text-secondary: oklch(0.4 0.005 30);
  --color-text-muted: oklch(0.55 0.003 30);
  --color-border-subtle: oklch(0.87 0.01 50 / 0.3);
  --color-border-medium: oklch(0.82 0.01 50 / 0.4);
  --color-border-strong: oklch(0.75 0.01 50 / 0.5);
}
body { background-color: #f8f5f4; }
nextjs-portal { display: none !important; }
`

function agoraDoMotor(): number {
  const congelado = process.env.GAUNTLET_AGORA
  if (congelado) {
    const ms = Date.parse(congelado)
    if (!Number.isNaN(ms)) return ms
  }
  return Date.now()
}

export default async function GauntletAprendizagemPadroesEvolucaoPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ fonte?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const { fonte } = await searchParams
  const usarFixture = fonte === "fixture"

  const dados = usarFixture ? entradaFixturePadroes() : await carregarPadroesDoBanco(agoraDoMotor())

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS estático e literal, sem interpolação. */}
      <style dangerouslySetInnerHTML={{ __html: LIGHT_TOKENS }} />
      <ForceLightTheme />
      <div
        data-gauntlet-root
        data-fonte={usarFixture ? "fixture" : "motor"}
        data-agora={usarFixture ? AGORA_FIXTURE : undefined}
        className="w-[1672px]"
      >
        <PreviewShell>
          <MolduraAprendizagem
            vista="padroes"
            destino={DESTINO_INERTE}
            controles={CONTROLES_INERTES}
          />
          <PadroesEvolucaoTab data={dados} />
        </PreviewShell>
      </div>
    </>
  )
}
