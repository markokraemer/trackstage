import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiUserAddLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/errors"

/**
 * Add one evaluator to a plan. Deliberately a plain inline form (not a drawer):
 * inviting a reviewer is a two-second job and shouldn't cost a modal.
 */
export function AddEvaluatorForm({
  planId,
  className,
}: {
  planId: Id<"evaluationPlans">
  className?: string
}) {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const addEvaluator = useMutation({
    mutationFn: useConvexMutation(api.evaluationsAdmin.addEvaluator),
  })

  function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.")
      return
    }
    setError(null)
    addEvaluator.mutate(
      { planId, email: trimmed, name: name.trim() || undefined },
      {
        onSuccess: () => {
          setEmail("")
          setName("")
          toast.success(`${trimmed} added`, {
            description: "Copy their review link from the table to invite them.",
          })
        },
        onError: (mutationError: Error) =>
          setError(errorMessage(mutationError, "Please try again.")),
      },
    )
  }

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-wrap items-end gap-3">
        <Field className="min-w-[16rem] flex-1">
          <FieldLabel htmlFor="add-evaluator-email">
            Evaluator email
            <span className="required-asterisk">*</span>
          </FieldLabel>
          <Input
            id="add-evaluator-email"
            type="email"
            value={email}
            placeholder="reviewer@example.com"
            onChange={(inputEvent) => setEmail(inputEvent.target.value)}
          />
        </Field>
        <Field className="min-w-[12rem] flex-1">
          <FieldLabel htmlFor="add-evaluator-name">
            Name <span className="text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="add-evaluator-name"
            value={name}
            placeholder="Sam Whitfield"
            onChange={(inputEvent) => setName(inputEvent.target.value)}
          />
        </Field>
        <Button type="submit" disabled={addEvaluator.isPending}>
          <RiUserAddLine aria-hidden />
          {addEvaluator.isPending ? "Adding…" : "Add evaluator"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
