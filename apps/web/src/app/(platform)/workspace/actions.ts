"use server"

import { getAuthProfile } from "@/lib/auth"
import { clearActiveContext, setActiveContext } from "@/lib/context-context"
import { buildAvailable, workspaceLandingContext } from "@/lib/context-resolver"
import { type WorkspaceId, setActiveWorkspace } from "@/lib/workspace-context"
import { canAccessWorkspace, workspaceHomeRoute } from "@/lib/workspace-resolver"
import type { Role } from "@eximia/shared"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

/** Cross-world travessia: validate REACH by hats, set the ephemeral workspace
 *  cookie, and CLEAR every residual state that belongs to the world being left
 *  (x-active-context, x-view-as-student, x-role-lens). This is the anti-
 *  residual-state rule (§3.1). Then land on the workspace home. */
export async function switchWorkspace(ws: WorkspaceId) {
  const { roles, hasSubordinates, hasEnrollment } = await getAuthProfile()
  if (!canAccessWorkspace(roles as Role[], ws)) {
    // Not reachable by this user's hats => fail-closed, do not switch.
    redirect("/workspace")
  }
  await setActiveWorkspace(ws)
  // Wipe residual axes so nothing leaks across the door.
  await clearActiveContext()
  const c = await cookies()
  if (c.get("x-view-as-student")) c.delete("x-view-as-student")
  // Role-lens axis retired (WP5); wipe any legacy cookie a browser still carries
  // so nothing leaks across the door. Inlined here now that role-lens-context.ts
  // is deleted.
  if (c.get("x-role-lens")) c.delete("x-role-lens")

  // ── Padrão do mundo PADRÃO: a travessia assenta a trilha do aluno ──────────
  // A regra anti-residual-state (§3.1, acima) deixa de ser "limpar tudo" e passa
  // a ser "limpar tudo e ASSENTAR o padrão do mundo em que se está entrando".
  // Por quê: limpar sozinho não devolve um estado neutro — devolve o estado
  // FRESCO, e o read-path (`resolveContext`) trata estado fresco subindo para o
  // chapéu mais alto (`defaultContext`, precedência E1). Resultado observado em
  // produção: quem é gestor E aluno escolhia "Plataforma de Aprendizagem" e caía
  // em "Ritmo da Equipe", nunca na própria trilha. Ou seja, o "limpar" não era
  // neutro; ele herdava silenciosamente o padrão de LOGIN num evento que não é
  // login. Assentar o sentinel explícito acaba com essa herança.
  //
  // Escopo deliberadamente estreito (só o mundo `standard`, só quando o destino
  // é `personal`):
  //  - `defaultContext` NÃO é tocado, então o padrão de LOGIN (gestor vê o time)
  //    segue valendo para quem chega a /dashboard sem passar por esta porta;
  //  - gestor PURO (sem matrícula) não tem contexto `personal`, então
  //    `workspaceLandingContext` devolve o mesmo `defaultContext` de antes e nada
  //    é escrito — o estado fresco dele fica idêntico ao de hoje, sem trilha
  //    vazia e sem cookie de gestão persistido que congelasse o padrão por 8h;
  //  - `studio` e `admin` não usam este eixo para decidir a casca, então saem
  //    daqui com o contexto limpo, como sempre.
  // O caminho de volta para a gestão continua sendo o ContextSwitcher do header
  // ("Minha Trilha / Meu Time / Minha Organização"), e essa escolha persiste.
  if (ws === "standard") {
    const landing = workspaceLandingContext(buildAvailable(roles, hasSubordinates, hasEnrollment))
    if (landing.type === "personal") await setActiveContext({ type: "personal", id: null })
  }

  redirect(workspaceHomeRoute(ws))
}
