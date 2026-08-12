import { afterEach, describe, expect, it, vi } from "vitest"

import {
  MAX_DELIVERY_ATTEMPTS,
  retryDelayForAttempt,
  sendTransactionalEmail,
} from "../../convex/platformEmails"

const email = {
  to: "organizer@trackstage.test",
  subject: "Delivery probe",
  html: "<p>Proof</p>",
  kind: "test",
  idempotencyKey: "platform-email/test-delivery",
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("platform email transport", () => {
  it("classifies 429 and 5xx provider responses as retryable", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.spyOn(console, "error").mockImplementation(() => undefined)

    for (const status of [429, 500, 503]) {
      const fetchMock = vi.fn<typeof fetch>(async () =>
        new Response("provider unavailable", { status }),
      )
      vi.stubGlobal("fetch", fetchMock)

      await expect(sendTransactionalEmail(email)).resolves.toEqual({
        status: "failed",
        error: `Resend ${status}: provider unavailable`,
        retryable: true,
      })
      const [, init] = fetchMock.mock.calls[0] ?? []
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
        email.idempotencyKey,
      )
    }
  })

  it("classifies a permanent 4xx rejection as terminal", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad recipient", { status: 422 })),
    )

    await expect(sendTransactionalEmail(email)).resolves.toEqual({
      status: "failed",
      error: "Resend 422: bad recipient",
      retryable: false,
    })
  })

  it("classifies a network failure as retryable", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("socket reset")
      }),
    )

    await expect(sendTransactionalEmail(email)).resolves.toEqual({
      status: "failed",
      error: "socket reset",
      retryable: true,
    })
  })

  it("records provider acceptance and preserves its receipt id", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ id: "resend_receipt_123" }, { status: 200 }),
      ),
    )

    await expect(sendTransactionalEmail(email)).resolves.toEqual({
      status: "sent",
      resendId: "resend_receipt_123",
    })
  })

  it("does not call the provider without a key or for a demo address", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.stubEnv("RESEND_API_KEY", "")
    await expect(sendTransactionalEmail(email)).resolves.toEqual({
      status: "preview",
      reason: "no RESEND_API_KEY",
    })

    vi.stubEnv("RESEND_API_KEY", "re_test")
    await expect(
      sendTransactionalEmail({ ...email, to: "demo@example.com" }),
    ).resolves.toEqual({ status: "preview", reason: "demo recipient" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("platform email retry policy", () => {
  it("uses the documented 1s, 5s, 25s and 125s backoff", () => {
    const retryable = {
      status: "failed" as const,
      error: "temporary",
      retryable: true,
    }
    expect([1, 2, 3, 4].map((attempt) => retryDelayForAttempt(attempt, retryable)))
      .toEqual([1_000, 5_000, 25_000, 125_000])
  })

  it("stops after five attempts and never retries terminal outcomes", () => {
    expect(
      retryDelayForAttempt(MAX_DELIVERY_ATTEMPTS, {
        status: "failed",
        error: "still unavailable",
        retryable: true,
      }),
    ).toBeNull()
    expect(
      retryDelayForAttempt(1, {
        status: "failed",
        error: "bad recipient",
        retryable: false,
      }),
    ).toBeNull()
    expect(retryDelayForAttempt(1, { status: "sent" })).toBeNull()
    expect(
      retryDelayForAttempt(1, { status: "preview", reason: "demo" }),
    ).toBeNull()
  })
})
