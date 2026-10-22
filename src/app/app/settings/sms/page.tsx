'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { RoleGate } from '@/components/shared/role-gate'
import { SectionTitle } from '@/components/shared/page-header'
import { ErrorState, TableSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/controls'
import { Field, Label } from '@/components/ui/form-field'
import { Input, Textarea } from '@/components/ui/input'
import { useSmsConfig, useUpdateSms, useUpdateTemplate } from '@/hooks/api'
import { t } from '@/i18n'
import { MERGE_FIELDS, renderTemplate, sampleVars, smsUnits } from '@/lib/sms'
import { formatCount } from '@/lib/utils'
import type { SmsSettings, SmsTemplate } from '@/types'

export default function SmsSettingsPage() {
  return (
    <RoleGate permission="settings.sms" page="SMS settings">
      <SmsSettingsView />
    </RoleGate>
  )
}

function SmsSettingsView() {
  const config = useSmsConfig()
  return (
    <>
      <SectionTitle>SMS reminders</SectionTitle>
      {config.isLoading ? (
        <TableSkeleton rows={4} />
      ) : config.isError || !config.data ? (
        <ErrorState onRetry={() => config.refetch()} />
      ) : (
        <div className="grid gap-6">
          <GeneralCard settings={config.data.settings} />
          <section aria-labelledby="tpl-h">
            <h3 id="tpl-h" className="mb-2 font-heading text-base font-semibold">
              Message templates
            </h3>
            <div className="grid gap-4">
              {config.data.templates.map((tpl) => (
                <TemplateCard key={tpl.id} template={tpl} />
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function GeneralCard({ settings }: { settings: SmsSettings }) {
  const update = useUpdateSms()
  const [form, setForm] = React.useState({ enabled: settings.enabled, senderName: settings.senderName, yearlyAllowance: String(settings.yearlyAllowance), warnAtPercent: String(settings.warnAtPercent) })
  const [errors, setErrors] = React.useState<Partial<Record<'senderName' | 'yearlyAllowance' | 'warnAtPercent', string>>>({})
  const dirty = form.enabled !== settings.enabled || form.senderName !== settings.senderName || Number(form.yearlyAllowance) !== settings.yearlyAllowance || Number(form.warnAtPercent) !== settings.warnAtPercent

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const allowance = Number(form.yearlyAllowance)
    const warn = Number(form.warnAtPercent)
    const next: typeof errors = {}
    if (!/^[A-Za-z0-9 ]{3,11}$/.test(form.senderName)) next.senderName = 'Use 3–11 letters or digits.'
    if (!Number.isInteger(allowance) || allowance < 0) next.yearlyAllowance = 'Enter a whole number, 0 or more.'
    if (!Number.isInteger(warn) || warn < 1 || warn > 100) next.warnAtPercent = 'Use a whole number from 1 to 100.'
    setErrors(next)
    if (Object.keys(next).length) return
    update.mutate(
      { enabled: form.enabled, senderName: form.senderName.trim(), yearlyAllowance: allowance, warnAtPercent: warn },
      { onSuccess: (s) => toast.success(s.enabled ? 'SMS settings saved.' : 'SMS reminders are turned off.') },
    )
  }

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardHeader>
          <div>
            <CardTitle>General</CardTitle>
            <CardDescription>Only lessees who consented to SMS can receive reminders.</CardDescription>
          </div>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3 sm:col-span-2">
            <div>
              <Label htmlFor="sms-enabled">Send SMS reminders</Label>
              <p className="text-[13px] text-ink-muted">When off, the Messages page shows a disabled state and nothing can be sent.</p>
            </div>
            <Switch id="sms-enabled" checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} />
          </div>
          <Field label="Sender name" htmlFor="sms-sender" error={errors.senderName} hint="Shown to recipients. 3–11 letters or digits.">
            <Input id="sms-sender" value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} aria-invalid={Boolean(errors.senderName)} />
          </Field>
          <Field label="Yearly allowance (messages)" htmlFor="sms-allowance" error={errors.yearlyAllowance}>
            <Input id="sms-allowance" inputMode="numeric" className="num" value={form.yearlyAllowance} onChange={(e) => setForm({ ...form, yearlyAllowance: e.target.value })} aria-invalid={Boolean(errors.yearlyAllowance)} />
          </Field>
          <Field label="Warn when usage reaches (%)" htmlFor="sms-warn" error={errors.warnAtPercent}>
            <Input id="sms-warn" inputMode="numeric" className="num" value={form.warnAtPercent} onChange={(e) => setForm({ ...form, warnAtPercent: e.target.value })} aria-invalid={Boolean(errors.warnAtPercent)} />
          </Field>
          <p className="self-end pb-2 text-[13px] text-ink-muted">
            Allowance in use: <span className="num">{formatCount(Number(form.yearlyAllowance) || 0)}</span> messages a year.
          </p>
        </CardBody>
        <CardFooter>
          <Button type="submit" disabled={!dirty || update.isPending}>
            {update.isPending ? t.common.saving : t.common.save}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function TemplateCard({ template }: { template: SmsTemplate }) {
  const update = useUpdateTemplate()
  const [name, setName] = React.useState(template.name)
  const [body, setBody] = React.useState(template.body)
  const [error, setError] = React.useState<string>()
  const dirty = name !== template.name || body !== template.body
  const preview = renderTemplate(body, sampleVars())
  const units = smsUnits(preview)
  const id = `tpl-${template.id}`
  const unknown = Array.from(body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g))
    .map((m) => m[1]!)
    .filter((k) => !MERGE_FIELDS.some((f) => f.key === k))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 3 || body.trim().length < 10) {
      setError('Give the template a name and a message of at least 10 characters.')
      return
    }
    if (unknown.length) {
      setError(`Unknown merge field: ${unknown.map((k) => `{{${k}}}`).join(', ')}.`)
      return
    }
    setError(undefined)
    update.mutate({ id: template.id, name, body }, { onSuccess: (tpl) => toast.success(`Template "${tpl.name}" saved.`) })
  }

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardBody className="grid gap-4">
          <Field label="Template name" htmlFor={`${id}-name`}>
            <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Message" htmlFor={`${id}-body`} error={error}>
            <Textarea id={`${id}-body`} rows={3} value={body} onChange={(e) => setBody(e.target.value)} aria-invalid={Boolean(error)} />
          </Field>
          <div className="rounded-md bg-surface-muted p-3">
            <p className="text-xs font-medium text-ink-muted">Preview with sample data</p>
            <p className="mt-1 text-sm">{preview}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {preview.length} characters · <span className="num">{units}</span> {units === 1 ? 'unit' : 'units'} per message
            </p>
          </div>
          <p className="text-xs text-ink-muted">
            Merge fields:{' '}
            {MERGE_FIELDS.map((f, i) => (
              <React.Fragment key={f.key}>
                <code className="font-mono">{`{{${f.key}}}`}</code>
                {i < MERGE_FIELDS.length - 1 ? ', ' : ''}
              </React.Fragment>
            ))}
          </p>
        </CardBody>
        <CardFooter>
          <Button type="submit" size="sm" disabled={!dirty || update.isPending}>
            {update.isPending ? t.common.saving : 'Save template'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
