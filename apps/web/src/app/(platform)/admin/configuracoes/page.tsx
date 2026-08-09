import { redirect } from "next/navigation"

/**
 * A raiz do hub não é uma tela, é a porta: entra direto na primeira seção viva.
 * O guard admin-tier já rodou no `layout.tsx` acima.
 */
export default function ConfiguracoesHubPage() {
  redirect("/admin/configuracoes/organizacao")
}
