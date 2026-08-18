import { AGORA_FIXTURE, entradaFixture } from "@/components/analytics/padroes-tendencias/fixture"
import { PadroesTendenciasTab } from "@/components/analytics/padroes-tendencias/padroes-tendencias-tab"
import { computePadroesTendencias } from "@/lib/analytics/padroes-tendencias"
import { notFound } from "next/navigation"
import { ForceLightTheme } from "../visao-geral/force-light-theme"
import { PreviewShell } from "../visao-geral/preview-shell"
import { carregarDoBanco } from "./leitura-real"

// ---------------------------------------------------------------------------
// /gauntlet-preview/padroes-tendencias — harness visual DEV-ONLY da aba
// "Padrões e tendências" do Analytics do gestor.
//
// A DIFERENÇA QUE ESTA ROTA TEM PARA A DA ABA ANTERIOR, e ela custou uma rodada:
// aqui o DEFAULT é o MOTOR. `?fonte=motor` (ou nenhum parâmetro) lê o banco e
// monta a tela pelo código de produção; `?fonte=fixture` empurra um mundo
// sintético congelado pelo MESMO motor.
//
//   • Nos DOIS modos quem calcula é a camada. Não existe caminho em que a tela
//     leia número escrito à mão. Na aba anterior o preview desenhava fixture com
//     os valores prontos, e por isso correções existiam no código sem aparecer
//     na tela de inspeção — o loop media uma segunda implementação.
//   • O modo fixture existe só pela determinismo: mundo congelado, screenshot
//     byte a byte reprodutível entre rodadas.
//
// Contrato do harness (herdado da aba anterior, e por isso REUSADO por import,
// nunca copiado): 404 em produção; tema LIGHT forçado em 3 camadas; largura FIXA
// de 1672px; moldura REAL da Academy via <PreviewShell/>.
//
// Screenshot: node scripts/gauntlet-shot.mjs /tmp/gauntlet/padroes.png
// (a rota do tiro vem de GAUNTLET_ROTA — ver o cabeçalho do script)
// ---------------------------------------------------------------------------

// Harness descartável: nunca prerenderizar nem cachear. No modo motor isto
// também garante que cada tiro leia o banco de novo, em vez de fotografar um
// HTML velho e chamá-lo de "estado atual".
export const dynamic = "force-dynamic"

// Valores copiados do bloco `:root` (light) de apps/web/src/styles/theme.css.
// Duplicação DELIBERADA e local: neutralizar `.dark` sem tocar em arquivo de
// produção. Regra sem cascade layer vence regra dentro de @layer base, que é
// onde vive o `.dark`.
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

/* O indicador de dev do Next é renderizado num <nextjs-portal> e ENTRA no
 * screenshot, contaminando toda candidata na mesma região. */
nextjs-portal { display: none !important; }
`

/**
 * O relógio do modo MOTOR.
 *
 * `GAUNTLET_AGORA` permite congelar o instante para o screenshot ser comparável
 * entre duas rodadas mesmo lendo o banco. Sem ele, o relógio é o de verdade —
 * que é o certo para quem abre a URL para inspecionar o estado atual.
 */
function agoraDoMotor(): number {
  const congelado = process.env.GAUNTLET_AGORA
  if (congelado) {
    const ms = Date.parse(congelado)
    if (!Number.isNaN(ms)) return ms
  }
  return Date.now()
}

export default async function GauntletPadroesTendenciasPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ fonte?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const { fonte } = await searchParams
  // DEFAULT = MOTOR. Só o valor explícito "fixture" desvia para o mundo
  // sintético; qualquer outra coisa (inclusive lixo na URL) cai no caminho de
  // produção, que é o comportamento seguro para um trilho de inspeção.
  const usarFixture = fonte === "fixture"

  const dados = usarFixture
    ? computePadroesTendencias(entradaFixture())
    : await carregarDoBanco(agoraDoMotor())

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
          <PadroesTendenciasTab dados={dados} />
        </PreviewShell>
      </div>
    </>
  )
}
