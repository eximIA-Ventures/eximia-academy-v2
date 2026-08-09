import { Building2, Mail } from "lucide-react"

/**
 * Bloco de upsell do módulo `units`, extraído de `admin/areas/page.tsx` sem
 * nenhuma alteração de conteúdo, para que a rota antiga e a seção do hub
 * (`/admin/configuracoes/unidades`) mostrem exatamente a MESMA tela quando o
 * tenant não tem o módulo no plano.
 */
export function UnitsModuleUpsell() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-bg-card shadow-card p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cerrado-600/10">
        <Building2 size={28} className="text-cerrado-600" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary">Módulo Unidades Gerenciais</h2>
      <p className="mt-2 text-sm text-text-secondary leading-relaxed">
        Organize sua empresa em unidades (filiais, plantas, departamentos) com dashboards e filtros
        independentes por unidade.
      </p>
      <p className="mt-4 text-sm text-text-muted">
        Este módulo não está incluso no seu plano atual.
      </p>
      <a
        href="mailto:contato@eximiaventures.com.br?subject=Interesse%20em%20Unidades%20Gerenciais"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cerrado-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-cerrado-700 active:scale-[0.98]"
      >
        <Mail size={16} />
        Entrar em contato
      </a>
    </div>
  )
}
