import { Building2 } from "lucide-react"
import Link from "next/link"

/**
 * Estado honesto de "nenhuma empresa resolvível" DENTRO do mundo do admin.
 *
 * Correção de auditoria (rodada 2), FURO 4. A cadeia antiga era:
 * `admin/settings/loader.ts` devolve `no-tenant` -> a página fazia
 * `redirect("/admin/tenants")` -> `admin/tenants` só abre para `super_admin` ->
 * `redirect("/dashboard")` -> e `/dashboard` reescreve o cookie
 * `x-active-workspace` para `standard`. Resultado: o ADMIN GLOBAL (tenant_id
 * nulo) era EJETADO do mundo administrativo por clicar em "Configurações".
 *
 * Correção de auditoria (rodada 3): a CÓPIA deste estado era falsa. Ela mandava
 * "escolher a empresa no seletor do topo", mas o loader não lia o cookie que o
 * seletor grava — escolher não mudava nada, nunca. O loader foi corrigido
 * (`settings/loader.ts`, via `resolveTenantId`), e com isso este estado deixou
 * de ser um beco: ele só aparece quando NÃO HÁ empresa resolvível (sem tenant
 * próprio, sem cookie de empresa ativa e sem nenhum tenant no banco). O texto
 * abaixo descreve esse estado, e só ele.
 */
export function TenantRequiredState({
  /** Só o super_admin abre `/admin/tenants` (guard da rota). Para os demais o
   *  caminho é o seletor do cabeçalho — mandá-los ao `/admin/tenants` seria
   *  recriar a ejeção que este componente existe para matar. */
  canManageTenants = false,
}: {
  canManageTenants?: boolean
}) {
  return (
    <div className="rounded-2xl bg-bg-card p-8 text-center shadow-card">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cerrado-600/10">
        <Building2 size={22} className="text-cerrado-600" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-text-primary">Nenhuma empresa disponível</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary leading-relaxed">
        Estas configurações pertencem a uma empresa específica, e nenhuma empresa foi encontrada
        para esta conta. Se o seletor de empresa no topo do painel listar alguma, escolha-a; se a
        lista estiver vazia, é preciso cadastrar a primeira empresa antes.
      </p>

      {canManageTenants && (
        <Link
          href="/admin/tenants"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cerrado-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Gerenciar empresas
        </Link>
      )}
    </div>
  )
}
