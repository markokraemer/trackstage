import { useState } from "react"
import { RiLockPasswordLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LabeledField } from "@/components/settings/labeled-field"
import { authErrorMessage } from "@/components/account/auth-error"
import { authClient } from "@/lib/auth-client"

const MIN_LENGTH = 8

interface PasswordErrors {
  current?: string
  next?: string
  confirm?: string
}

/**
 * Change your password (Better Auth `changePassword`). Signing the other
 * sessions out is the safe default when a password changes — say so plainly
 * rather than hiding it behind a checkbox nobody reads.
 */
export function PasswordCard() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [saving, setSaving] = useState(false)

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    const nextErrors: PasswordErrors = {}
    if (!current) nextErrors.current = "Enter your current password."
    if (next.length < MIN_LENGTH) {
      nextErrors.next = `Use at least ${MIN_LENGTH} characters.`
    } else if (next === current) {
      nextErrors.next = "Choose a password you haven't used here before."
    }
    if (confirm !== next) nextErrors.confirm = "These two don't match."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    const result = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    })
    setSaving(false)

    if (result.error) {
      const message = authErrorMessage(
        result.error,
        "Couldn't change your password — try again.",
      )
      setErrors({
        current: /current password/i.test(message) ? message : undefined,
        next: /current password/i.test(message) ? undefined : message,
      })
      toast.error(message)
      return
    }

    setCurrent("")
    setNext("")
    setConfirm("")
    setErrors({})
    toast.success("Password changed — your other devices were signed out")
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiLockPasswordLine size={18} aria-hidden className="text-primary" />
          Password
        </CardTitle>
        <CardDescription>
          Changing your password signs you out everywhere else. You stay signed
          in here.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* POST so a native submit can never put these passwords in the URL. */}
        <form
          method="post"
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-5"
        >
          {/* Stacked on purpose: three-across put the middle field's helper
              text between label and input and broke every baseline. Changing
              a password is sequential — one focused column reads best. */}
          <div className="flex max-w-sm flex-col gap-5">
            <LabeledField
              label="Current password"
              htmlFor="current-password"
              required
              error={errors.current}
            >
              <Input
                id="current-password"
                type="password"
                value={current}
                autoComplete="current-password"
                aria-invalid={errors.current ? true : undefined}
                onChange={(changeEvent) => setCurrent(changeEvent.target.value)}
              />
            </LabeledField>

            <LabeledField
              label="New password"
              htmlFor="new-password"
              required
              error={errors.next}
              description={`At least ${MIN_LENGTH} characters.`}
            >
              <Input
                id="new-password"
                type="password"
                value={next}
                autoComplete="new-password"
                aria-invalid={errors.next ? true : undefined}
                onChange={(changeEvent) => setNext(changeEvent.target.value)}
              />
            </LabeledField>

            <LabeledField
              label="Confirm new password"
              htmlFor="confirm-password"
              required
              error={errors.confirm}
            >
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                autoComplete="new-password"
                aria-invalid={errors.confirm ? true : undefined}
                onChange={(changeEvent) => setConfirm(changeEvent.target.value)}
              />
            </LabeledField>
          </div>

          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Changing…" : "Change password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
