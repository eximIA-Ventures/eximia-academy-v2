import { describe, expect, it, vi } from "vitest"

vi.mock("@sentry/nextjs", () => ({
  setUser: vi.fn(),
  setTag: vi.fn(),
}))

import * as Sentry from "@sentry/nextjs"
import { setSentryContext } from "../sentry"

describe("setSentryContext", () => {
  it("sets user id, tenant_id tag, and route tag", () => {
    setSentryContext("user-123", "tenant-456", "/api/sessions/1/messages")

    expect(Sentry.setUser).toHaveBeenCalledWith({ id: "user-123" })
    expect(Sentry.setTag).toHaveBeenCalledWith("tenant_id", "tenant-456")
    expect(Sentry.setTag).toHaveBeenCalledWith("route", "/api/sessions/1/messages")
  })
})
