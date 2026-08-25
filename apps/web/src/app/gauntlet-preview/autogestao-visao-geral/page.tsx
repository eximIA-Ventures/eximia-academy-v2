import {
  MolduraAutogestao,
  lerPeriodoAutogestao,
} from "@/app/(platform)/jornada/_autogestao/moldura"
import { VisaoGeralAutogestaoTab } from "@/components/analytics/autogestao/visao-geral-tab"
import { notFound } from "next/navigation"
import { ForceLightTheme } from "../visao-geral/force-light-theme"
import { hrefAbaPreview } from "./href-aba-preview"
import type { Aluno } from "./leitura-real"
import { carregarVisaoGeralAutogestao } from "./leitura-real"
import { PreviewShellAutogestao } from "./preview-shell-autogestao"

// ---------------------------------------------------------------------------
// /gauntlet-preview/autogestao-visao-geral — harness visual DEV-ONLY da Tela 1
// ("Visão Geral") da Autogestão da minha Jornada (`/jornada?vista=autogestao`).
//
// POR QUE ESTA ROTA EXISTE: a rota real fica atrás de auth
// (`(platform)/jornada` redireciona para `/login` sem sessão — `curl` nunca
// alcança a tela). Este harness renderiza o MESMO componente de produção,
// `VisaoGeralAutogestaoTab` (`@/components/analytics/autogestao/
// visao-geral-tab.tsx`), alimentado por dado lido do tenant descartável
// "gauntlet-descartavel" pelo MESMO caminho de leitura de produção
// (`lerFonteAutogestao` + `montarVisaoGeralAutogestao`, ver `./leitura-real.ts`)
// — nunca uma segunda implementação da tela.
//
// Contrato do harness (herdado das 3 rotas irmãs do gestor, e por isso
// REUSADO por import — `ForceLightTheme` nunca duplicado): 404 em produção;
// tema LIGHT forçado em 3 camadas. DIVERGE do trio do gestor em dois pontos,
// medidos contra a referência do dono (1440px, SEM barra lateral):
// largura FIXA de 1440px (não 1672 — não há `<Sidebar/>` a compensar); e a
// moldura é `<PreviewShellAutogestao/>` (Header real do produto, sem barra
// lateral, contexto PESSOAL do aluno) envolvendo `<MolduraAutogestao/>`
// (cabeçalho "Autogestão da minha Jornada" + as 3 abas — `_autogestao/
// moldura.tsx`, a MESMA moldura que `_visao-geral/painel.tsx` monta em
// produção).
//
//   • `?aluno=a|b` (default "a") — os 2 alunos que `semear.mjs` planta: A COM
//     plano, B SEM plano. B é o caminho MAJORITÁRIO (297 de 302 matrículas
//     reais não têm plano), e por isso tem que ser fotografável como A.
//   • `?agora=<ISO>` (default fixo 2026-08-21T12:00:00Z) — o relógio congelado
//     do cenário. NUNCA `new Date()`: um relógio vivo muda o significado do
//     cenário a cada dia e reprova o determinismo (pré-voo G1 do /gauntlet-2).
//   • `?periodo=7|30|90` (default 30, `lerPeriodoAutogestao`) — o MESMO
//     default do produto real. O 7 continua alcançável explicitamente,
//     porque é dele que a prova do elo 4 depende (ver `./leitura-real.ts`).
//   • Se o cenário não estiver semeado, a página diz isso em texto claro — ver
//     `<CenarioNaoSemeado/>` abaixo — e NUNCA renderiza uma tela vazia que
//     passaria por tela legítima.
// ---------------------------------------------------------------------------

// Harness descartável: nunca prerenderizar nem cachear. Cada tiro relê o
// banco, nunca fotografa um HTML velho e o chama de "estado atual".
export const dynamic = "force-dynamic"

/** O relógio fixo do cenário — literal idêntico ao usado por `semear.mjs`. */
const AGORA_PADRAO_ISO = "2026-08-21T12:00:00Z"

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

export default async function GauntletAutogestaoVisaoGeralPreviewPage({
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

  const resultado = await carregarVisaoGeralAutogestao(
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
              abaAtiva="visao-geral"
              queryAtual={queryAtual}
              periodoDias={periodoDias}
              hrefDeAba={hrefAbaPreview(queryAtual)}
            >
              <VisaoGeralAutogestaoTab dados={resultado.dados} />
            </MolduraAutogestao>
          ) : (
            <CenarioNaoSemeado motivo={resultado.motivo} />
          )}
        </PreviewShellAutogestao>
      </div>
    </>
  )
}
