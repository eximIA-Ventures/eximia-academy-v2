import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from("tenants").select("id").limit(1)

    if (error) {
      return NextResponse.json(
        { status: "unhealthy", error: error.message, timestamp: new Date().toISOString() },
        { status: 503 },
      )
    }

    return NextResponse.json({ status: "healthy", timestamp: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { status: "unhealthy", error: (err as Error).message, timestamp: new Date().toISOString() },
      { status: 503 },
    )
  }
}
