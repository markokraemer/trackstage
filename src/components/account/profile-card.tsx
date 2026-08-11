import { useState } from "react"
import { RiUserSettingsLine } from "@remixicon/react"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LabeledField } from "@/components/settings/labeled-field"
import { authErrorMessage } from "@/components/account/auth-error"
import { authClient } from "@/lib/auth-client"

/**
 * Your profile — account level, not workspace or event level. The name here is
 * what teammates and speakers see on invites and emails, in every workspace
 * you belong to (docs/memory/RULES.md 23b).
 */
export function ProfileCard({
  name,
  email,
}: {
  name: string
  email: string
}) {
  const [draft, setDraft] = useState(name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const trimmed = draft.trim()
  const isDirty = trimmed !== name.trim()

  async function save(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    if (!isDirty) return
    if (!trimmed) {
      setError("Tell us what to call you.")
      return
    }
    setError(undefined)
    setSaving(true)
    const result = await authClient.updateUser({ name: trimmed })
    setSaving(false)
    if (result.error) {
      const message = authErrorMessage(
        result.error,
        "Couldn't save your name — try again.",
      )
      setError(message)
      toast.error(message)
      return
    }
    toast.success("Your profile was updated")
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiUserSettingsLine size={18} aria-hidden className="text-primary" />
          Your profile
        </CardTitle>
        <CardDescription>
          How you appear to your teammates and on the emails you send. This
          follows you into every workspace you belong to.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={save} noValidate className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-11">
              <AvatarFallback>{initials(trimmed || email)}</AvatarFallback>
            </Avatar>
            <p className="text-sm text-muted-foreground">
              Your initials are used as your avatar for now.
            </p>
          </div>

          <div className="grid items-start gap-5 md:grid-cols-2">
            <LabeledField
              label="Full name"
              htmlFor="account-name"
              required
              error={error}
              description="Shown in the account menu, on invites and in activity."
            >
              <Input
                id="account-name"
                value={draft}
                autoComplete="name"
                aria-invalid={error ? true : undefined}
                placeholder="Ada Lovelace"
                onChange={(changeEvent) => setDraft(changeEvent.target.value)}
              />
            </LabeledField>

            <LabeledField
              label="Email address"
              htmlFor="account-email"
              description="The address you sign in with. It can't be changed here — email support and we'll move it for you."
            >
              <Input
                id="account-email"
                value={email}
                readOnly
                disabled
                autoComplete="email"
              />
            </LabeledField>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!isDirty || saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {isDirty ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraft(name)
                  setError(undefined)
                }}
              >
                Discard
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
