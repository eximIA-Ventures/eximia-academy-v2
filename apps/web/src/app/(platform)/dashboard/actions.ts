"use server"

import type { WeeklyPlan } from "@/components/dashboard/types"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const ALLOWED_TIMES = ["07h", "08h", "12h", "19h", "21h"]

export interface SaveWeeklyPlanInput {
  goal: number
  days: number[]
  reminderEnabled: boolean
  reminderTime: string
}

/**
 * Persists the student's weekly plan under users.profile.weekly_plan (JSONB).
 * Email sending is phase 2, only the preference is stored here.
 */
export async function saveWeeklyPlan(
  input: SaveWeeklyPlanInput,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  // Validate goal
  const goal = Math.trunc(input.goal)
  if (!Number.isFinite(goal) || goal < 1 || goal > 7) {
    return { error: "Meta deve ser entre 1 e 7 sessões" }
  }

  // Validate days: unique integers 0..6 (0 = Monday)
  const days = [...new Set(input.days.map((d) => Math.trunc(d)))].filter((d) => d >= 0 && d <= 6)
  if (days.length === 0) {
    return { error: "Escolha pelo menos um dia da semana" }
  }
  days.sort((a, b) => a - b)

  // Validate reminder time
  const time = ALLOWED_TIMES.includes(input.reminderTime) ? input.reminderTime : "08h"

  const plan: WeeklyPlan = {
    goal,
    days,
    reminder: {
      enabled: Boolean(input.reminderEnabled),
      time,
    },
  }

  const { error } = await supabase.rpc("jsonb_profile_merge", {
    p_user_id: user.id,
    p_set_key: "weekly_plan",
    p_set_value: JSON.stringify(plan),
  })

  if (error) {
    console.error("Failed to save weekly plan:", error.message)
    return { error: "Erro ao salvar o plano da semana" }
  }

  revalidatePath("/dashboard")
  return { success: true }
}
