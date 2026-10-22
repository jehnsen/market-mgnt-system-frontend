'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { UploadIcon } from 'lucide-react'
import { RoleGate } from '@/components/shared/role-gate'
import { SectionTitle } from '@/components/shared/page-header'
import { ErrorState, TableSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { useBranding, useUpdateBranding } from '@/hooks/api'
import { t } from '@/i18n'
import { lguConfig } from '@/config/lgu'
import type { BrandingSettings } from '@/types'

const MAX_SEAL_BYTES = 512 * 1024

export default function BrandingPage() {
  return (
    <RoleGate permission="settings.branding" page="branding settings">
      <SectionTitle>Branding</SectionTitle>
      <BrandingLoader />
    </RoleGate>
  )
}

function BrandingLoader() {
  const branding = useBranding()
  if (branding.isLoading) return <TableSkeleton rows={4} />
  if (branding.isError || !branding.data) return <ErrorState onRetry={() => branding.refetch()} />
  return <BrandingForm branding={branding.data} />
}

type TextKey = Exclude<keyof BrandingSettings, 'sealDataUrl'>

const FIELDS: { key: TextKey; label: string; hint?: string }[] = [
  { key: 'municipality', label: 'Municipality' },
  { key: 'province', label: 'Province' },
  { key: 'officeName', label: 'Office name', hint: 'Appears in the header of every official document.' },
  { key: 'publicMarketName', label: 'Public market name' },
  { key: 'seafoodMarketName', label: 'Seafood market name' },
]

function BrandingForm({ branding }: { branding: BrandingSettings }) {
  const update = useUpdateBranding()
  const [form, setForm] = React.useState<BrandingSettings>(branding)
  const [errors, setErrors] = React.useState<Partial<Record<TextKey | 'seal', string>>>({})
  const fileRef = React.useRef<HTMLInputElement>(null)
  const dirty = (Object.keys(branding) as (keyof BrandingSettings)[]).some((k) => form[k] !== branding[k])
  const sealSrc = form.sealDataUrl ?? lguConfig.sealPath

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setErrors((p) => ({ ...p, seal: 'Choose a PNG, JPG or SVG image.' }))
    if (file.size > MAX_SEAL_BYTES) return setErrors((p) => ({ ...p, seal: 'The image must be 512 KB or smaller.' }))
    const reader = new FileReader()
    reader.onload = () => {
      setErrors((p) => ({ ...p, seal: undefined }))
      setForm((f) => ({ ...f, sealDataUrl: String(reader.result) }))
    }
    reader.readAsDataURL(file)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    for (const f of FIELDS) if (form[f.key].trim().length < 3) next[f.key] = `Enter the ${f.label.toLowerCase()}.`
    setErrors(next)
    if (Object.keys(next).length) return
    update.mutate(
      { ...form, municipality: form.municipality.trim(), province: form.province.trim(), officeName: form.officeName.trim(), publicMarketName: form.publicMarketName.trim(), seafoodMarketName: form.seafoodMarketName.trim() },
      { onSuccess: () => toast.success('Branding saved.') },
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <form onSubmit={submit} noValidate>
          <CardHeader>
            <div>
              <CardTitle>LGU details</CardTitle>
              <CardDescription>Used in the app header, login screen and the heading of printed documents.</CardDescription>
            </div>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`br-${f.key}`} error={errors[f.key]} hint={f.hint} className={f.key === 'officeName' ? 'sm:col-span-2' : undefined}>
                <Input id={`br-${f.key}`} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} aria-invalid={Boolean(errors[f.key])} />
              </Field>
            ))}
            <Field label="Municipal seal" htmlFor="br-seal" error={errors.seal} hint="PNG, JPG or SVG, up to 512 KB. Square images work best." className="sm:col-span-2">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sealSrc} alt="Current municipal seal" className="size-16 rounded-full border border-border bg-surface object-contain p-1" />
                <input ref={fileRef} id="br-seal" type="file" accept="image/*" className="sr-only" onChange={onFile} />
                <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                  <UploadIcon /> Upload seal
                </Button>
                {form.sealDataUrl ? (
                  <Button type="button" variant="ghost" onClick={() => setForm({ ...form, sealDataUrl: null })}>
                    Use default seal
                  </Button>
                ) : null}
              </div>
            </Field>
          </CardBody>
          <CardFooter>
            <Button type="button" variant="secondary" disabled={!dirty} onClick={() => setForm(branding)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={!dirty || update.isPending}>
              {update.isPending ? t.common.saving : t.common.save}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <aside aria-label="Document header preview">
        <h3 className="mb-2 text-sm font-semibold">Document header preview</h3>
        <div className="rounded-lg border border-border bg-white p-5 text-center text-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sealSrc} alt="" className="mx-auto size-14 object-contain" />
          <p className="mt-2 text-[10px] tracking-widest uppercase">Republic of the Philippines</p>
          <p className="text-[10px] tracking-widest uppercase">Province of {form.province || '—'}</p>
          <p className="mt-1 text-sm font-semibold">Municipality of {form.municipality || '—'}</p>
          <p className="text-xs">{form.officeName || '—'}</p>
          <p className="mt-1 text-xs text-neutral-600">
            {form.publicMarketName} · {form.seafoodMarketName}
          </p>
        </div>
      </aside>
    </div>
  )
}
