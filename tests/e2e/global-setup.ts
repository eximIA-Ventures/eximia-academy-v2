import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { seedTestData } from "./helpers/seed"

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIndex = trimmed.indexOf("=")
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "")
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  } catch {
    // File not found — skip silently
  }
}

export default async function globalSetup() {
  // Load env vars from apps/web/.env.local for Supabase credentials
  loadEnvFile(resolve(process.cwd(), "apps/web/.env.local"))

  // Map NEXT_PUBLIC_SUPABASE_URL to SUPABASE_URL if not already set
  if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  }

  console.log("[e2e] Seeding test data...")
  await seedTestData()
  console.log("[e2e] Test data seeded successfully")
}
