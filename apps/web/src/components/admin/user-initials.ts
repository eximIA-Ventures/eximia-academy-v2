/**
 * Iniciais para o avatar de uma pessoa.
 *
 * Mora num módulo próprio porque a lista e o drawer precisam das MESMAS
 * iniciais, e os dois já se referenciam mutuamente (a lista renderiza o drawer,
 * o drawer importa o tipo da lista). Colocar a função em qualquer um dos dois
 * criaria um ciclo de import de verdade, não só de tipo.
 *
 * Não há foto armazenada em produção — a coluna `users.avatar_url` não existe —,
 * então a inicial NÃO é um fallback raro: é o que todo mundo vê.
 */
export function initialsOf(user: { full_name?: string | null; email: string }): string {
  const source = user.full_name?.trim() || user.email
  const parts = source.split(/\s+/).filter(Boolean)
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)
  return letters.toUpperCase()
}
