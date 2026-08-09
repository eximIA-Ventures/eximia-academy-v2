/**
 * Cabeçalho leve das seções do hub.
 *
 * As telas antigas usam o `PageHeader` (banner grande com imagem), que existe
 * para uma página de largura inteira. Dentro do hub a moldura já é dada pelo
 * `layout.tsx` (título + sidebar), então a seção usa este cabeçalho enxuto. O
 * conteúdo interativo montado abaixo é exatamente o MESMO componente da tela
 * antiga — o que muda aqui é só a moldura.
 */
export function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <header className="space-y-1">
      <h2 className="text-xl font-bold text-text-primary">{title}</h2>
      <p className="text-sm text-text-secondary">{description}</p>
    </header>
  )
}
