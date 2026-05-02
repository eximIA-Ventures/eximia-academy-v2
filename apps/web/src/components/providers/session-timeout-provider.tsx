"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface SessionTimeoutProviderProps {
  timeoutHours: number
  children: React.ReactNode
}

export function SessionTimeoutProvider({
  timeoutHours,
  children,
}: SessionTimeoutProviderProps) {
  const router = useRouter()

  useEffect(() => {
    if (!timeoutHours || timeoutHours <= 0) return

    const supabase = createClient()

    const checkTimeout = async () => {
      // FIX-H4: Use getUser() (server-validated) instead of getSession() (local JWT)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.last_sign_in_at) return

      const signInTime = new Date(user.last_sign_in_at).getTime()
      const elapsedHours = (Date.now() - signInTime) / 3600000

      if (elapsedHours >= timeoutHours) {
        await supabase.auth.signOut()
        router.push("/login?error=session_expired")
      }
    }

    checkTimeout()
    const interval = setInterval(checkTimeout, 60000)
    return () => clearInterval(interval)
  }, [timeoutHours, router])

  return <>{children}</>
}
