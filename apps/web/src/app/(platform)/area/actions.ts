"use server"

import { clearActiveArea, setActiveArea } from "@/lib/area-context"
import { revalidatePath } from "next/cache"

export async function switchArea(areaId: string) {
  await setActiveArea(areaId)
  revalidatePath("/", "layout")
}

export async function exitAreaContext() {
  await clearActiveArea()
  revalidatePath("/", "layout")
}
