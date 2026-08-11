import { useCallback, useEffect, useRef, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { toast } from "sonner"

import { friendlyError } from "./model"
import type {
  FormDoc,
  FormQuestion,
  FormSettings,
  ParticipantConfig,
} from "./model"

/**
 * Local draft of a form + autosave (docs/SPEC.md §2.11 — speed is a feature).
 *
 * Every edit lands in local state immediately (no round-trip lag), then a
 * debounced write goes to Convex. Moving between wizard steps and the explicit
 * Save button both flush the pending write, so nothing is ever lost.
 */

export interface FormDraft {
  internalName: string
  externalTitle: string
  pageHeading: string
  welcomeMessage: string
  showWelcomeMessage: boolean
  kind: string
  status: string
  closeAt: number | null
  questions: Array<FormQuestion>
  participantConfig: ParticipantConfig
  settings: FormSettings
  notifyEmails: Array<string>
}

export function draftFromDoc(form: FormDoc): FormDraft {
  return {
    internalName: form.internalName,
    externalTitle: form.externalTitle,
    pageHeading: form.pageHeading ?? "",
    welcomeMessage: form.welcomeMessage ?? "",
    showWelcomeMessage: form.showWelcomeMessage,
    kind: form.kind,
    status: form.status,
    closeAt: form.closeAt ?? null,
    questions: form.questions.map((question) => ({ ...question })),
    participantConfig: {
      ...form.participantConfig,
      fields: form.participantConfig.fields.map((field) => ({ ...field })),
    },
    settings: { ...form.settings },
    notifyEmails: [...form.notifyEmails],
  }
}

/** The exact shape `api.forms.update` accepts. */
function draftToPatch(draft: FormDraft) {
  return {
    internalName: draft.internalName.trim() || "Untitled form",
    externalTitle: draft.externalTitle,
    pageHeading: draft.pageHeading,
    welcomeMessage: draft.welcomeMessage,
    showWelcomeMessage: draft.showWelcomeMessage,
    kind: draft.kind,
    status: draft.status,
    closeAt: draft.closeAt,
    questions: draft.questions,
    participantConfig: draft.participantConfig,
    settings: draft.settings,
    notifyEmails: draft.notifyEmails,
  }
}

export type SaveState = "saved" | "unsaved" | "saving" | "error"

export interface UseFormDraftResult {
  draft: FormDraft
  /** Merge a partial patch into the draft (marks it unsaved). */
  patch: (values: Partial<FormDraft>) => void
  /** Functional update for list-shaped fields. */
  update: (updater: (draft: FormDraft) => FormDraft) => void
  /** Write now; resolves true when the form is safely stored. */
  save: () => Promise<boolean>
  saveState: SaveState
  /** Message from the last rejected save (server validation). */
  saveError: string | null
}

const AUTOSAVE_DELAY_MS = 900

export function useFormDraft(form: FormDoc): UseFormDraftResult {
  const updateForm = useConvexMutation(api.forms.update)

  const [draft, setDraft] = useState<FormDraft>(() => draftFromDoc(form))
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [saveError, setSaveError] = useState<string | null>(null)

  const draftRef = useRef(draft)
  draftRef.current = draft
  const dirtyRef = useRef(false)
  const inFlightRef = useRef(false)
  const queuedRef = useRef(false)
  const formIdRef = useRef(form._id)

  // Switching to a different form (or arriving fresh) reloads the draft.
  // While editing one form we deliberately do NOT re-sync from the reactive
  // query — that would clobber keystrokes with the server's older copy.
  useEffect(() => {
    if (formIdRef.current !== form._id) {
      formIdRef.current = form._id
      dirtyRef.current = false
      setDraft(draftFromDoc(form))
      setSaveState("saved")
      setSaveError(null)
    }
  }, [form])

  /** Read through a function so the value is never assumed stale across awaits. */
  const isDirty = useCallback(() => dirtyRef.current, [])

  const save = useCallback(async (): Promise<boolean> => {
    if (!isDirty()) return true
    if (inFlightRef.current) {
      queuedRef.current = true
      return true
    }
    inFlightRef.current = true
    dirtyRef.current = false
    setSaveState("saving")
    try {
      await updateForm({
        formId: formIdRef.current,
        patch: draftToPatch(draftRef.current),
      })
      setSaveError(null)
      setSaveState(isDirty() ? "unsaved" : "saved")
      return true
    } catch (error) {
      dirtyRef.current = true
      const message = friendlyError(error, "We couldn't save your changes.")
      setSaveError(message)
      setSaveState("error")
      toast.error(message)
      return false
    } finally {
      inFlightRef.current = false
      if (queuedRef.current) {
        queuedRef.current = false
        dirtyRef.current = true
        void save()
      }
    }
  }, [updateForm, isDirty])

  const markDirty = useCallback(() => {
    dirtyRef.current = true
    setSaveState("unsaved")
  }, [])

  const patch = useCallback(
    (values: Partial<FormDraft>) => {
      setDraft((current) => ({ ...current, ...values }))
      markDirty()
    },
    [markDirty],
  )

  const update = useCallback(
    (updater: (current: FormDraft) => FormDraft) => {
      setDraft((current) => updater(current))
      markDirty()
    },
    [markDirty],
  )

  // Debounced autosave.
  useEffect(() => {
    if (!isDirty()) return
    const timer = setTimeout(() => {
      void save()
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft, save, isDirty])

  return { draft, patch, update, save, saveState, saveError }
}
