// ---------------------------------------------------------------------------
// "Padrões e tendências" e "Mapa da jornada" — as duas abas que ainda não têm
// conteúdo.
// ---------------------------------------------------------------------------
// O que esta tela NÃO faz, e é o ponto dela: não mostra número nenhum. Uma aba
// com rótulo real e gráfico de mentira é pior que uma aba vazia, porque o
// gestor decide sobre gente com base no que lê — é o mesmo defeito do achado
// A-1 da auditoria (tela limpa apresentada como fato), só que caro de propósito
// em vez de por descuido.
//
// O GATE DE ACESSO É REPETIDO AQUI, e isso não é redundância desnecessária:
// este ramo retorna ANTES de todo o corpo de `analytics/page.tsx`, então ele
// não herda gate nenhum. São os mesmos papéis de `ANALYTICS_ACCESS_ROLES` e o
// mesmo destino de recusa (`/dashboard`).
//
// SOMENTE LEITURA — nem isso, na verdade: esta tela não consulta banco.
// ---------------------------------------------------------------------------

import { TEXTO } from "@/components/analytics/visao-geral/design"
import { type DestinoAbas, NavAbas, hrefDaAba } from "@/components/analytics/visao-geral/nav-abas"
import { type AbaId, abasComAtiva } from "@/lib/analytics/visao-geral/abas"
import { getAuthProfile } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import type { Role } from "@eximia/shared"
import Link from "next/link"
import { redirect } from "next/navigation"

const ACESSO: Role[] = ["leader", "manager", "admin", "instructor", "super_admin"]

/**
 * O que cada aba vai responder quando existir, e — enquanto não existe — onde
 * o gestor encontra hoje a informação mais próxima disso.
 *
 * A segunda metade é a parte que não pode faltar. "Em construção" sozinho
 * manda o gestor embora achando que o dado não existe; ele existe, mudou de
 * lugar, e o painel anterior continua servido em `?tab=legado`.
 */
const PROMESSA: Record<AbaId, { titulo: string; pergunta: string; enquantoIsso: string }> = {
  "visao-geral": {
    titulo: "Visão geral",
    pergunta: "",
    enquantoIsso: "",
  },
  padroes: {
    titulo: "Padrões e tendências",
    pergunta:
      "Como o comportamento da equipe se move ao longo do tempo — sessões por semana, evolução de profundidade, modos de interação e o que mudou entre um período e o anterior.",
    enquantoIsso:
      "As séries temporais de uso e de profundidade continuam no painel anterior, na aba “Uso da Plataforma” e na aba “Aprendizagem”.",
  },
  mapa: {
    titulo: "Mapa da jornada",
    pergunta:
      "Onde cada pessoa está no percurso — funil por módulo, quem parou em qual capítulo e o mapa aluno × módulo.",
    enquantoIsso:
      "O funil por módulo e o mapa de progresso aluno × módulo continuam no painel anterior, nas abas “Uso da Plataforma” e “Alunos”.",
  },
}

export async function TelaEmConstrucao({
  aba,
  destino,
}: {
  aba: Exclude<AbaId, "visao-geral">
  destino: DestinoAbas
}) {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")
  if (!hasAnyRole({ roles: roles as Role[] }, ACESSO)) return redirect("/dashboard")

  const promessa = PROMESSA[aba]
  // Mesma função que monta o href das abas: um lugar só decide como `?tab=` é
  // reescrito preservando o resto da query.
  const paraLegado = hrefDaAba(destino, "legado")

  return (
    <div className="pt-0 pr-[56px] pl-[31px]" style={{ color: TEXTO.primario }}>
      <header>
        <h1
          className="text-[33px] leading-[36px] font-bold"
          style={{ color: TEXTO.primario, letterSpacing: "-0.021em", wordSpacing: "2px" }}
        >
          {promessa.titulo}
        </h1>
        <p
          className="mt-[4px] text-[14.8px] leading-[20px]"
          style={{ color: TEXTO.terciario, letterSpacing: "-0.004em" }}
        >
          Esta aba ainda não foi construída.
        </p>
      </header>

      <NavAbas abas={abasComAtiva(aba)} destino={destino} />

      <div className="mt-[18px] max-w-[720px] rounded-[12px] border border-border-subtle bg-bg-card p-6">
        <p className="text-sm font-semibold text-text-primary">
          Nada é exibido aqui porque nada foi medido ainda
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          Quando existir, esta aba vai responder: {promessa.pergunta}
        </p>
        <p className="mt-3 text-sm text-text-secondary">{promessa.enquantoIsso}</p>
        <p className="mt-4 text-sm">
          <Link href={paraLegado} className="font-semibold text-cerrado-600 hover:underline">
            Abrir o painel anterior
          </Link>
          <span className="text-text-muted">
            {" "}
            — nenhum painel foi removido, os três antigos continuam inteiros.
          </span>
        </p>
      </div>
    </div>
  )
}
