import { createServiceClient } from "@/lib/supabase/service"

import type { WebhookEvent } from "./events"
import { MAX_ATTEMPTS, getNextRetryAt } from "./retry"
import { signPayload } from "./signer"

export async function dispatchEvent(
  tenantId: string,
  eventType: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const supabase = createServiceClient()

  // Find all active webhooks for this tenant + event type
  const { data: hooks } = await supabase
    .from("webhooks")
    .select("id, url, secret, events")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)

  if (!hooks || hooks.length === 0) return

  const matchingHooks = hooks.filter((h) => h.events.includes(eventType) || h.events.includes("*"))

  // Fan-out: fire-and-forget delivery for each webhook
  for (const hook of matchingHooks) {
    deliverWebhook(supabase, {
      webhookId: hook.id,
      tenantId,
      eventType,
      payload,
      url: hook.url,
      secret: hook.secret,
    }).catch((err) => {
      console.error(`[webhook] Failed to deliver ${eventType} to ${hook.url}:`, err)
    })
  }
}

async function deliverWebhook(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    webhookId: string
    tenantId: string
    eventType: string
    payload: Record<string, unknown>
    url: string
    secret: string
  },
): Promise<void> {
  const body = JSON.stringify({
    event: params.eventType,
    timestamp: new Date().toISOString(),
    data: params.payload,
  })

  const signature = await signPayload(body, params.secret)

  // Create delivery record
  const { data: delivery } = await supabase
    .from("webhook_deliveries")
    .insert({
      webhook_id: params.webhookId,
      tenant_id: params.tenantId,
      event_type: params.eventType,
      payload: params.payload,
      status: "pending",
      attempts: 1,
    })
    .select("id")
    .single()

  if (!delivery) return

  try {
    const response = await fetch(params.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": params.eventType,
        "X-Webhook-Delivery": delivery.id,
      },
      body,
      signal: AbortSignal.timeout(10000),
    })

    if (response.ok) {
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "delivered",
          last_status_code: response.status,
          completed_at: new Date().toISOString(),
        })
        .eq("id", delivery.id)
    } else {
      await handleFailure(
        supabase,
        delivery.id,
        params.webhookId,
        response.status,
        `HTTP ${response.status}`,
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    await handleFailure(supabase, delivery.id, params.webhookId, null, message)
  }
}

async function handleFailure(
  supabase: ReturnType<typeof createServiceClient>,
  deliveryId: string,
  webhookId: string,
  statusCode: number | null,
  error: string,
): Promise<void> {
  // Get current attempt count
  const { data: delivery } = await supabase
    .from("webhook_deliveries")
    .select("attempts")
    .eq("id", deliveryId)
    .single()

  const attempts = delivery?.attempts ?? 1
  const nextRetry = getNextRetryAt(attempts)

  if (nextRetry) {
    // Schedule retry
    await supabase
      .from("webhook_deliveries")
      .update({
        status: "retrying",
        last_status_code: statusCode,
        last_error: error,
        next_retry_at: nextRetry.toISOString(),
      })
      .eq("id", deliveryId)
  } else {
    // Max retries exceeded
    await supabase
      .from("webhook_deliveries")
      .update({
        status: "failed",
        last_status_code: statusCode,
        last_error: error,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deliveryId)

    // Increment webhook failure count (direct update)
    await supabase.from("webhooks").update({ failure_count: attempts }).eq("id", webhookId)
  }
}

export async function retryPendingDeliveries(): Promise<number> {
  const supabase = createServiceClient()

  const { data: pending } = await supabase
    .from("webhook_deliveries")
    .select("id, webhook_id, tenant_id, event_type, payload, attempts")
    .in("status", ["pending", "retrying"])
    .lte("next_retry_at", new Date().toISOString())
    .limit(50)

  if (!pending || pending.length === 0) return 0

  let processed = 0
  for (const delivery of pending) {
    // Get webhook details
    const { data: hook } = await supabase
      .from("webhooks")
      .select("url, secret, is_active")
      .eq("id", delivery.webhook_id)
      .single()

    if (!hook || !hook.is_active) {
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "failed",
          last_error: "Webhook disabled",
          completed_at: new Date().toISOString(),
        })
        .eq("id", delivery.id)
      continue
    }

    const body = JSON.stringify({
      event: delivery.event_type,
      timestamp: new Date().toISOString(),
      data: delivery.payload,
    })

    const signature = await signPayload(body, hook.secret)
    const newAttempts = (delivery.attempts ?? 0) + 1

    try {
      const response = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": delivery.event_type,
          "X-Webhook-Delivery": delivery.id,
        },
        body,
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok) {
        await supabase
          .from("webhook_deliveries")
          .update({
            status: "delivered",
            attempts: newAttempts,
            last_status_code: response.status,
            completed_at: new Date().toISOString(),
          })
          .eq("id", delivery.id)
      } else {
        const nextRetry = getNextRetryAt(newAttempts)
        await supabase
          .from("webhook_deliveries")
          .update({
            status: nextRetry ? "retrying" : "failed",
            attempts: newAttempts,
            last_status_code: response.status,
            last_error: `HTTP ${response.status}`,
            next_retry_at: nextRetry?.toISOString() ?? null,
            completed_at: nextRetry ? null : new Date().toISOString(),
          })
          .eq("id", delivery.id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      const nextRetry = getNextRetryAt(newAttempts)
      await supabase
        .from("webhook_deliveries")
        .update({
          status: nextRetry ? "retrying" : "failed",
          attempts: newAttempts,
          last_error: message,
          next_retry_at: nextRetry?.toISOString() ?? null,
          completed_at: nextRetry ? null : new Date().toISOString(),
        })
        .eq("id", delivery.id)
    }

    processed++
  }

  return processed
}
