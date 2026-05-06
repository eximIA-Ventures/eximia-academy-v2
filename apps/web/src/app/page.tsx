import { redirect } from "next/navigation"

/**
 * Root page — redirect to login.
 * Landing page is now external (eximiaacademy.com).
 * Tenant apps go straight to login.
 */
export default function Home() {
  redirect("/login")
}
