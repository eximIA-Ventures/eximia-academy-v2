import { AGORA_FIXTURE, entradaFixture } from "@/components/analytics/aprendizagem-time/fixture"
import { VisaoGeralAprendizagemTab } from "@/components/analytics/aprendizagem-time/visao-geral-tab"
import { MolduraAprendizagem } from "@/app/(platform)/analytics/_aprendizagem-time/moldura"
import { notFound } from "next/navigation"
import { ForceLightTheme } from "../visao-geral/force-light-theme"
import { PreviewShell } from "../visao-geral/preview-shell"
import { carregarDoBanco } from "./leitura-real"

/**
 * Destino/controles INERTES para o harness — sem roteador real, sem sessão.
 * Mesmo espírito de `abasComAtiva()` sem `destino` em `nav-abas.tsx`: os links
 * da moldura existem visualmente, mas o preview não depende deles navegando.
 */
const DESTINO_INERTE = { pathname: "/gauntlet-preview/aprendizagem-visao-geral", query: "fonte=fixture" }
const CONTROLES_INERTES = {
  periodoDias: 30 as const,
  escopoEquipe: "diretos" as const,
  escopoEditavel: true,
  cursoId: null,
  cursos: [{ id: "curso-1", titulo: "Análise e Solução de Problemas" }],
  falhaCursos: false,
}

// ---------------------------------------------------------------------------
// /gauntlet-preview/aprendizagem-visao-geral — harness visual DEV-ONLY da
// Tela 1 (Visão Geral) do domínio "Aprendizagem do Time".
//
// Mesmo contrato das rotas de preview de Ativação (reusado por IMPORT, não
// copiado): `PreviewShell`/`ForceLightTheme` vêm de `../visao-geral/`; 404 em
// produção; tema light forçado; largura fixa 1672px; `?fonte=fixture|motor`,
// default MOTOR (a tela real, não uma segunda implementação de fixture).
//
// Screenshot: GAUNTLET_ROTA=aprendizagem-visao-geral node scripts/gauntlet-shot.mjs out.png
// Medição de layout: node scripts/gauntlet-medir.mjs aprendizagem-visao-geral 1366,1440,1512
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic"

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

export default async function GauntletAprendizagemVisaoGeralPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ fonte?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const { fonte } = await searchParams
  const usarFixture = fonte === "fixture"

  const dados = usarFixture ? entradaFixture() : await carregarDoBanco(agoraDoMotor())

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
            vista="visao-geral"
            destino={DESTINO_INERTE}
            controles={CONTROLES_INERTES}
          />
          <VisaoGeralAprendizagemTab data={dados} />
        </PreviewShell>
      </div>
    </>
  )
}
