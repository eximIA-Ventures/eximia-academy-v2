export const WEBHOOK_EVENTS = [
  "course.created",
  "course.updated",
  "blueprint.generated",
  "enrollment.created",
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]
