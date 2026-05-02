import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL

export function createDrizzleClient(url?: string) {
  const client = postgres(url || connectionString || "")
  return drizzle(client, { schema })
}

export type Database = ReturnType<typeof createDrizzleClient>
