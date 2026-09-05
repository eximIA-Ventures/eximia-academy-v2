// ===========================================================================
// O HOST CANÔNICO DE UMA EMPRESA É DERIVADO POR STRING, SEM BANCO (D1).
//
// `{slug}.{NEXT_PUBLIC_APP_BASE_DOMAIN}` é o endereço que existe no segundo em
// que a empresa é cadastrada — nenhuma linha em `tenant_domains`, nenhum ticket
// de DNS no cliente. `tenant_domains` guarda SÓ o domínio próprio, o endereço
// que NÃO é derivável do slug (`06-contrato-de-dados.md` §2.1).
//
// Por que a env é lida por extenso, e não por `process.env[chave]`: este módulo
// é importado também pelo wizard, que é `"use client"`. No navegador
// `process.env` não existe; o único valor que sobrevive é o que o Next INLINA em
// build, e ele só inlina `process.env.NEXT_PUBLIC_X` escrito literalmente. Um
// acesso dinâmico viraria `undefined` no browser — o wizard mostraria um host
// vazio enquanto o servidor devolveria o certo. Mesmo motivo, mesma forma que
// `tenant.config.ts` já usa.
//
// Este arquivo NÃO depende de `lib/tenant.ts`: é uma função de string, e a
// resolução de tenant por request (middleware) é outro eixo.
// ===========================================================================

/** `""` é ausência: o EasyPanel grava string vazia quando o campo fica em branco. */
export function baseDomainDaPlataforma(): string | null {
  const bruto = (process.env.NEXT_PUBLIC_APP_BASE_DOMAIN ?? "").trim().toLowerCase()
  const semPontos = bruto.replace(/^\.+/, "").replace(/\.+$/, "")
  return semPontos === "" ? null : semPontos
}

/**
 * `null` quando o domínio base não está configurado — é a verdade, e é melhor do
 * que devolver `"cory."` e deixar um host quebrado circular por e-mail e por tela.
 * Quem exibe decide o que dizer no lugar.
 */
export function hostCanonico(slug: string): string | null {
  const base = baseDomainDaPlataforma()
  const limpo = slug.trim().toLowerCase()
  if (!base || limpo === "") return null
  return `${limpo}.${base}`
}
