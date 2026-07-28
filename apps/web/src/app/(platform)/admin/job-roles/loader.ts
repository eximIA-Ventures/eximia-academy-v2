import { listAreas, listJobRolesWithStats, listTenantTrails } from "./actions"

/**
 * Loader único dos cargos (com estatísticas) + áreas do tenant.
 *
 * A query em si já vivia num módulo compartilhado (`./actions`), então o loader
 * apenas compõe as duas chamadas num ponto só, para que a rota antiga
 * (`/admin/job-roles`, que segue viva e liberada para `manager` e `instructor`)
 * e a seção do hub (`/admin/configuracoes/cargos`) leiam pelo MESMO caminho.
 *
 * CFG-3.1 acrescentou a terceira leitura: o catálogo de trilhas da empresa, que
 * alimenta o "+ Vincular trilha" do drawer. Ela entra AQUI, e não dentro do
 * componente, para que as duas rotas continuem lendo pelo mesmo caminho — a
 * regra que este loader existe para garantir.
 */
export async function loadAdminJobRoles() {
  const [rolesResult, areasResult, trailsResult] = await Promise.all([
    listJobRolesWithStats(),
    listAreas(),
    listTenantTrails(),
  ])

  return {
    roles: rolesResult.data ?? [],
    areas: areasResult.data ?? [],
    trails: trailsResult.data ?? [],
  }
}
