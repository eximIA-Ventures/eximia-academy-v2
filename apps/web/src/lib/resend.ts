import { Resend } from "resend"

const apiKey = process.env.RESEND_API_KEY

if (!apiKey) {
  console.warn("[resend] RESEND_API_KEY not configured — email sending disabled")
}

export const resend = apiKey ? new Resend(apiKey) : null
