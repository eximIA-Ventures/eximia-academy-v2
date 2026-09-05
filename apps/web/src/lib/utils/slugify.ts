export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: intencional - remove marcas diacriticas combinantes (U+0300-U+036F) apos normalizacao NFD para gerar o slug sem acentos.
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50)
  )
}
