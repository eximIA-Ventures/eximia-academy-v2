import { createClient } from "@/lib/supabase/server"

export interface LeaderboardEntry {
  userId: string
  fullName: string
  xp: number
  level: number
  currentStreak: number
  badges: string[]
}

const XP_REWARDS = {
  session_completed: 50,
  chapter_completed: 100,
  course_completed: 500,
  quiz_perfect: 200,
  assessment_completed: 75,
  streak_bonus: 10,
} as const

export type XpEvent = keyof typeof XP_REWARDS

export function getXpForEvent(event: XpEvent): number {
  return XP_REWARDS[event]
}

/**
 * Get leaderboard for a tenant (top N users by XP)
 */
export async function getLeaderboard(tenantId: string, limit = 20): Promise<LeaderboardEntry[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("user_gamification")
    .select("user_id, xp, level, current_streak, badges, users!inner(full_name)")
    .eq("tenant_id", tenantId)
    .order("xp", { ascending: false })
    .limit(limit)

  if (!data) return []

  return data.map((row: any) => ({
    userId: row.user_id,
    fullName: row.users.full_name,
    xp: row.xp,
    level: row.level,
    currentStreak: row.current_streak,
    badges: row.badges ?? [],
  }))
}

/**
 * Get a user's gamification stats
 */
export async function getUserStats(userId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("user_gamification")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (!data) {
    return {
      xp: 0,
      level: 1,
      currentStreak: 0,
      maxStreak: 0,
      badges: [] as string[],
    }
  }

  return {
    xp: data.xp,
    level: data.level,
    currentStreak: data.current_streak,
    maxStreak: data.max_streak,
    badges: data.badges ?? [],
  }
}
