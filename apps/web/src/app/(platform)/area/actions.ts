"use server"

import { clearActiveArea, setActiveArea } from "@/lib/area-context"

// NÃO chamar revalidatePath aqui. revalidatePath re-renderiza a rota DENTRO desta
// request — cujo cookie ainda é o ANTIGO (o Set-Cookie só vale na próxima request).
// Esse render "com cookie velho" competia com o router.refresh() do cliente (que já
// roda com o cookie novo) e frequentemente sobrescrevia os dados corretos, fazendo o
// dashboard parecer não reagir à troca de Unidade. A única atualização é o
// router.refresh() no AreaSelector, que dispara uma request nova já com o cookie novo.
export async function switchArea(areaId: string) {
  await setActiveArea(areaId)
}

export async function exitAreaContext() {
  await clearActiveArea()
}
