import { VISAO_GERAL_COMPLETA } from "@/components/analytics/visao-geral/fixture"
import { VisaoGeralTab } from "@/components/analytics/visao-geral/visao-geral-tab"
import { notFound } from "next/navigation"
import { ForceLightTheme } from "./force-light-theme"
import { carregarDoBanco } from "./leitura-real"
import { PreviewShell } from "./preview-shell"

// ---------------------------------------------------------------------------
// /gauntlet-preview/visao-geral — harness visual DEV-ONLY da aba "Visão geral"
// do Analytics do gestor.
//
// Contrato desta rota (é o trilho do loop, não a tela final):
//   • SEM login. `?fonte=fixture` desenha o mundo sintético congelado de
//     @/components/analytics/visao-geral/fixture.ts; `?fonte=motor` (o DEFAULT,
//     igual ao das outras duas abas) lê o banco pelo caminho de produção — ver
//     ./leitura-real.ts. Até 2026-08-18 esta rota só tinha o caminho da
//     fixture, e por isso todo defeito que só existe com dado real (o tile "No
//     ritmo" sem comparação, por exemplo) era invisível ao trilho de medição;
//   • 404 em produção (guard abaixo). Nunca alcançável num deploy;
//   • tema LIGHT forçado em 3 camadas independentes (ver abaixo);
//   • largura FIXA de 1672px, para ser comparável pixel a pixel ao PNG de
//     referência 01-visao-geral.png;
//   • a MOLDURA é a real da Academy (barra lateral e cabeçalho de plataforma),
//     montada por <PreviewShell/> com props literais — ver preview-shell.tsx.
//
// Screenshot: node scripts/gauntlet-shot.mjs /tmp/gauntlet/prova.png
//
// AS 3 CAMADAS DE LIGHT MODE (o app é dark-default; sem isso o screenshot
// dependeria do tema do SO da máquina que roda o loop):
//   1. o <style> abaixo, SEM cascade layer, redeclara os tokens claros em
//      :root — regra sem layer sempre vence regra dentro de @layer base, que é
//      onde vive o `.dark` de styles/theme.css. Vale independente da classe;
//   2. <ForceLightTheme/> remove a classe `dark` do <html> e a mantém removida
//      (MutationObserver), cobrindo as variantes utilitárias `dark:` do
//      Tailwind, que olham a CLASSE e não os tokens;
//   3. o script de screenshot abre o contexto com colorScheme: "light", então o
//      ThemeProvider em modo "system" já resolve para claro na origem.
// Camada 1 é suficiente para cor; 2 e 3 existem porque não controlamos que
// utilitários `dark:` os componentes finais vão usar.
// ---------------------------------------------------------------------------

// Harness descartável: nunca prerenderizar nem cachear.
export const dynamic = "force-dynamic"

// Valores copiados do bloco `:root` (light) de apps/web/src/styles/theme.css.
// Duplicação DELIBERADA e local: o objetivo é neutralizar `.dark` sem tocar em
// nenhum arquivo de produção.
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

/* O indicador de dev do Next (disco flutuante no canto inferior esquerdo) é
 * renderizado num <nextjs-portal> e ENTRA no screenshot, contaminando toda
 * candidata na mesma região. Escondido aqui, e não em next.config.ts, para não
 * mexer em arquivo de produção por causa de um harness. */
nextjs-portal { display: none !important; }
`

/**
 * O relógio do modo MOTOR.
 *
 * `GAUNTLET_AGORA` permite congelar o instante para o screenshot ser comparável
 * entre duas rodadas mesmo lendo o banco — o mesmo mecanismo das outras abas.
 */
function agoraDoMotor(): number {
  const congelado = process.env.GAUNTLET_AGORA
  if (congelado) {
    const ms = Date.parse(congelado)
    if (!Number.isNaN(ms)) return ms
  }
  return Date.now()
}

export default async function GauntletVisaoGeralPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ fonte?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const { fonte } = await searchParams
  // DEFAULT = MOTOR, igual às outras duas abas. Só o valor explícito "fixture"
  // desvia para o mundo sintético; qualquer outra coisa (inclusive lixo na URL)
  // cai no caminho de produção, que é o comportamento seguro num trilho de
  // inspeção.
  const usarFixture = fonte === "fixture"
  const dados = usarFixture ? VISAO_GERAL_COMPLETA : await carregarDoBanco(agoraDoMotor())

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS estático e literal, sem interpolação. */}
      <style dangerouslySetInnerHTML={{ __html: LIGHT_TOKENS }} />
      <ForceLightTheme />
      <div data-gauntlet-root data-fonte={usarFixture ? "fixture" : "motor"} className="w-[1672px]">
        <PreviewShell>
          <VisaoGeralTab data={dados} />
        </PreviewShell>
      </div>
    </>
  )
}
