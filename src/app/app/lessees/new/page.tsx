'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LesseeForm } from '@/components/market/lessee-form'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardFooter } from '@/components/ui/card'
import { useCreateLessee } from '@/hooks/api'
import { t } from '@/i18n'

export default function NewLesseePage() {
  const router = useRouter()
  const create = useCreateLessee()
  return (
    <RoleGate permission="lessees.manage" page="lessee registration">
      <PageHeader title="New lessee" description="Register a vendor before leasing them a stall." />
      <Card className="max-w-3xl">
        <CardBody>
          <LesseeForm
            formId="new-lessee"
            onSubmit={(values) =>
              create.mutate(values, {
                onSuccess: (l) => {
                  toast.success(`${l.fullName} registered.`)
                  router.push(`/app/lessees/${l.id}`)
                },
              })
            }
          />
        </CardBody>
        <CardFooter>
          <Button variant="secondary" onClick={() => router.back()}>
            {t.common.cancel}
          </Button>
          <Button type="submit" form="new-lessee" disabled={create.isPending}>
            {create.isPending ? t.common.saving : 'Register lessee'}
          </Button>
        </CardFooter>
      </Card>
    </RoleGate>
  )
}
