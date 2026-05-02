import { describe, expect, it } from "vitest"

// Test the beforeSend logic extracted from sentry.client.config.ts
function beforeSend(event: Record<string, unknown>) {
  const req = event.request as Record<string, unknown> | undefined
  if (req?.headers) {
    const headers = req.headers as Record<string, string>
    delete headers["authorization"]
    delete headers["cookie"]
  }
  const user = event.user as Record<string, unknown> | undefined
  if (user) {
    delete user.email
    delete user.username
    delete user.ip_address
  }
  return event
}

describe("Sentry beforeSend scrubbing", () => {
  it("removes authorization and cookie headers", () => {
    const event = {
      request: {
        headers: {
          authorization: "Bearer secret-token",
          cookie: "session=abc123",
          "content-type": "application/json",
        },
      },
    }

    const result = beforeSend(event)
    const headers = (result.request as Record<string, unknown>).headers as Record<string, string>

    expect(headers.authorization).toBeUndefined()
    expect(headers.cookie).toBeUndefined()
    expect(headers["content-type"]).toBe("application/json")
  })

  it("removes PII from user context", () => {
    const event = {
      user: {
        id: "user-123",
        email: "test@example.com",
        username: "testuser",
        ip_address: "127.0.0.1",
      },
    }

    const result = beforeSend(event)
    const user = result.user as Record<string, unknown>

    expect(user.id).toBe("user-123")
    expect(user.email).toBeUndefined()
    expect(user.username).toBeUndefined()
    expect(user.ip_address).toBeUndefined()
  })

  it("handles events without request headers", () => {
    const event = { message: "test error" }
    const result = beforeSend(event)
    expect(result).toEqual({ message: "test error" })
  })
})
