/**
 * Better Auth returns `{ data, error }` rather than throwing, and its error
 * codes are machine-flavoured ("INVALID_PASSWORD"). Organizers get a sentence.
 */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback
  const { code, message } = error as { code?: unknown; message?: unknown }

  if (typeof code === "string") {
    const known: Record<string, string> = {
      INVALID_PASSWORD: "That current password isn't right.",
      INVALID_EMAIL_OR_PASSWORD: "That current password isn't right.",
      PASSWORD_TOO_SHORT: "Use at least 8 characters.",
      PASSWORD_TOO_LONG: "That password is too long.",
      CREDENTIAL_ACCOUNT_NOT_FOUND:
        "This account signs in without a password, so there's nothing to change.",
      SESSION_EXPIRED: "Your session expired — sign in again and retry.",
    }
    if (known[code]) return known[code]
  }

  if (typeof message === "string" && message.trim() && message.length < 200) {
    return message.trim()
  }
  return fallback
}
