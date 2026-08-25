import { PadroesAutogestaoTab } from "@/app/(platform)/jornada/_autogestao/_padroes/padroes-tab"
import {
  MolduraAutogestao,
  lerPeriodoAutogestao,
} from "@/app/(platform)/jornada/_autogestao/moldura"
import { notFound } from "next/navigation"
import { hrefAbaPreview } from "../autogestao-visao-geral/href-aba-preview"
import { PreviewShellAutogestao } from "../autogestao-visao-geral/preview-shell-autogestao"
import { ForceLightTheme } from "../visao-geral/force-light-theme"
import type { Aluno } from "./leitura-real"
import { carregarPadroesAutogestao } from "./leitura-real"

// ---------------------------------------------------------------------------
// /gauntlet-preview/autogestao-padroes — harness visual DEV-ONLY da Tela 2
// ("Meus Padrões e Tendências") da Autogestão da minha Jornada
// (`/jornada?vista=autogestao&aba=padroes`).
//
// A TELA INTEIRA É A DE PRODUÇÃO, IMPORTADA (não copiada). Até 2026-08-21
// esta rota carregava uma CÓPIA da composição de
// `_autogestao/_padroes/painel.tsx`, porque aquele Server Component resolve
// sessão via `_autogestao/recorte.ts` e, sem sessão, redireciona para
// `/login` — o mesmo problema que esta série de rotas existe para contornar.
//
// O preço da cópia apareceu DUAS vezes. Primeiro com os 4 cartões (corrigido
// extraindo `_autogestao/_padroes/cartoes.tsx`, apresentação pura). Depois com
// a própria COMPOSIÇÃO: quando `painel.tsx` ganhou os 2 cartões de mapa de
// calor, esta rota ainda montava só os 4 cartões antigos à mão — o crítico
// media uma tela que já não existia em produção. A correção definitiva foi
// extrair a composição inteira para `PadroesAutogestaoTab`
// (`_autogestao/_padroes/padroes-tab.tsx`), que produção e harness agora
// importam igualmente. Quem PRODUZ o dado (`lerFonteAutogestao` +
// `montarPadroesAutogestao` + `montarMapaDeCalorAtividade`, em
// `./leitura-real.ts`) já era 100% real e continua sendo.
//
// Contrato do harness (herdado das rotas irmãs): 404 em produção; tema LIGHT
// forçado em 3 camadas; largura FIXA de 1440px (a medida da referência do
// dono, SEM barra lateral); moldura REAL da Academy via
// <PreviewShellAutogestao/> (Header do produto, contexto PESSOAL do aluno,
// sem `<Sidebar/>` — a barra do gestor não pertence a esta tela).
//
//   • `?aluno=a|b` (default "a") — A com plano, B sem plano.
//   • `?agora=<ISO>` (default fixo 2026-08-21T12:00:00Z) — relógio congelado.
//   • `?periodo=7|30|90` (default 30, `lerPeriodoAutogestao`) — o MESMO
//     default do produto real. O 7 continua alcançável explicitamente,
//     porque é dele que a prova do elo 4 depende (ver `./leitura-real.ts`).
//   • Cenário não semeado → texto claro, nunca tela vazia disfarçada.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic"

const AGORA_PADRAO_ISO = "2026-08-21T12:00:00Z"

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

function agoraDoMotor(bruto: string | undefined): number {
  const iso = bruto ?? AGORA_PADRAO_ISO
  const ms = Date.parse(iso)
  if (!Number.isNaN(ms)) return ms
  return Date.parse(AGORA_PADRAO_ISO)
}

function alunoDaQuery(bruto: string | undefined): Aluno {
  return bruto === "b" ? "b" : "a"
}

/** `?tenant=` — slug do tenant a ler. Default "gauntlet-descartavel" (comportamento original). */
function tenantSlugDaQuery(bruto: string | undefined): string {
  const limpo = bruto?.trim()
  return limpo ? limpo : "gauntlet-descartavel"
}

/** O estado "cenário não semeado" — NUNCA uma tela vazia disfarçada de legítima. */
function CenarioNaoSemeado({ motivo }: { motivo: string }) {
  return (
    <div className="max-w-[640px] rounded-[10px] border border-dashed border-red-400 bg-red-50 p-[20px] text-[14px] leading-[20px] text-red-900">
      <p className="font-semibold">Cenário não semeado.</p>
      <p className="mt-[6px]">{motivo}</p>
    </div>
  )
}

export default async function GauntletAutogestaoPadroesPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    agora?: string
    aluno?: string
    periodo?: string
    tenant?: string
    estudante?: string
  }>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const {
    agora,
    aluno: alunoBruto,
    periodo: periodoBruto,
    tenant: tenantBruto,
    estudante,
  } = await searchParams
  const agoraMs = agoraDoMotor(agora)
  const aluno = alunoDaQuery(alunoBruto)
  const periodoDias = lerPeriodoAutogestao(periodoBruto)
  const tenantSlug = tenantSlugDaQuery(tenantBruto)
  const parametrosQuery: Record<string, string> = {
    agora: new Date(agoraMs).toISOString(),
    aluno,
    periodo: String(periodoDias),
  }
  if (tenantBruto) parametrosQuery.tenant = tenantSlug
  if (estudante) parametrosQuery.estudante = estudante
  const queryAtual = new URLSearchParams(parametrosQuery).toString()

  const resultado = await carregarPadroesAutogestao(
    agoraMs,
    aluno,
    periodoDias,
    tenantSlug,
    estudante,
  )

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS estático e literal, sem interpolação. */}
      <style dangerouslySetInnerHTML={{ __html: LIGHT_TOKENS }} />
      <ForceLightTheme />
      <div
        data-gauntlet-root
        data-fonte="motor"
        data-aluno={aluno}
        data-agora={new Date(agoraMs).toISOString()}
        data-periodo-dias={periodoDias}
        data-semeado={resultado.ok ? "sim" : "nao"}
        className="w-[1440px]"
      >
        <PreviewShellAutogestao>
          {resultado.ok ? (
            <MolduraAutogestao
              abaAtiva="padroes"
              queryAtual={queryAtual}
              periodoDias={periodoDias}
              hrefDeAba={hrefAbaPreview(queryAtual)}
            >
              <PadroesAutogestaoTab dados={resultado.dados} mapaDeCalor={resultado.mapaDeCalor} />
            </MolduraAutogestao>
          ) : (
            <CenarioNaoSemeado motivo={resultado.motivo} />
          )}
        </PreviewShellAutogestao>
      </div>
    </>
  )
}
