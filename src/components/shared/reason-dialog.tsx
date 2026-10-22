'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/form-field'
import { Textarea } from '@/components/ui/input'
import { t } from '@/i18n'

interface ReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  label?: string
  confirmLabel: string
  tone?: 'primary' | 'danger'
  minLength?: number
  pending?: boolean
  children?: React.ReactNode
  onConfirm: (reason: string) => void
}

/** Confirmation that requires a written reason (audited actions). */
export function ReasonDialog({ open, onOpenChange, title, description, label = t.common.reason, confirmLabel, tone = 'primary', minLength = 5, pending, children, onConfirm }: ReasonDialogProps) {
  const [reason, setReason] = React.useState('')
  const [touched, setTouched] = React.useState(false)
  const id = React.useId()
  const error = touched && reason.trim().length < minLength ? `Enter at least ${minLength} characters.` : undefined
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason('')
          setTouched(false)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (reason.trim().length >= minLength) onConfirm(reason.trim())
          }}
        >
          {children}
          <Field label={label} htmlFor={id} error={error}>
            <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} onBlur={() => setTouched(true)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} rows={3} />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant={tone} disabled={pending}>
              {pending ? t.common.saving : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
