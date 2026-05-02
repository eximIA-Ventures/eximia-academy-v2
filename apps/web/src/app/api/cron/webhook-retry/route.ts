import { retryPendingDeliveries } from "@/lib/webhooks"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const processed = await retryPendingDeliveries()

  return NextResponse.json({ processed })
}
