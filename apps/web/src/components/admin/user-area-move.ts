/**
 * "Mover de área" pelo lado da PESSOA (CFG-6.1, AC6).
 *
 * Até esta story o vínculo `user_areas` só era gerenciável pelo lado da ÁREA
 * (`/admin/areas/[areaId]/users`). Do lado da pessoa não havia nada — quem
 * queria mover alguém precisava saber de onde ele estava saindo.
 *
 * A regra aqui é: **nenhuma mutação nova**. Esta função chama exatamente os
 * mesmos endpoints que a tela de áreas já chama (`POST`/`DELETE` em
 * `/api/admin/areas/{areaId}/users`), na ordem certa. Escrever uma segunda rota
 * "de mover" seria criar um segundo lugar onde o vínculo pode ser criado — e
 * duas escritas concorrentes sobre a mesma tabela é como um usuário acaba em
 * duas áreas sem ninguém ter pedido isso.
 *
 * MOVER, e não ADICIONAR: os vínculos atuais saem antes de o novo entrar. Sem
 * isso, "mover" viria a significar "acumular", e a coluna Área da lista passaria
 * a mostrar um histórico em vez do estado.
 */

export interface MoveUserAreaInput {
  userId: string
  /** Áreas atuais da pessoa (podem ser várias — dado antigo). */
  currentAreaIds: string[]
  /** Área destino. `null` = apenas desvincular de todas. */
  targetAreaId: string | null
}

export type MoveUserAreaResult = { ok: true } | { ok: false; message: string }

type FetchLike = typeof fetch

export async function moveUserArea(
  { userId, currentAreaIds, targetAreaId }: MoveUserAreaInput,
  fetchImpl: FetchLike = fetch,
): Promise<MoveUserAreaResult> {
  const toRemove = currentAreaIds.filter((id) => id !== targetAreaId)

  if (toRemove.length === 0 && (targetAreaId === null || currentAreaIds.includes(targetAreaId))) {
    // Já está exatamente onde deveria: nenhuma escrita. Um POST redundante
    // devolveria 409 do próprio banco (`UNIQUE`), o que assustaria à toa.
    return { ok: true }
  }

  for (const areaId of toRemove) {
    const res = await fetchImpl(
      `/api/admin/areas/${areaId}/users?user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    )
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return {
        ok: false,
        message: typeof json.error === "string" ? json.error : "Erro ao remover da área atual.",
      }
    }
  }

  if (!targetAreaId || currentAreaIds.includes(targetAreaId)) return { ok: true }

  const res = await fetchImpl(`/api/admin/areas/${targetAreaId}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  })

  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    return {
      ok: false,
      message: typeof json.error === "string" ? json.error : "Erro ao vincular à nova área.",
    }
  }

  return { ok: true }
}
