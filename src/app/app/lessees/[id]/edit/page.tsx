'use client'

import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LesseeForm } from '@/components/market/lessee-form'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { ErrorState, PageSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardFooter } from '@/components/ui/card'
import { useLessee, useUpdateLessee } from '@/hooks/api'
import { t } from '@/i18n'

export default function EditLesseePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const q = useLessee(id)
  const update = useUpdateLessee()
  return (
    <RoleGate permission="lessees.manage" page="lessee editing">
      {q.isLoading ? (
        <PageSkeleton />
      ) : q.isError || !q.data ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <>
          <PageHeader title={`Edit ${q.data.lessee.fullName}`} documentTitle="Edit lessee" />
          <Card className="max-w-3xl">
            <CardBody>
              <LesseeForm
                formId="edit-lessee"
                defaultValues={{
                  firstName: q.data.lessee.firstName,
                  middleInitial: q.data.lessee.middleInitial,
                  lastName: q.data.lessee.lastName,
                  businessName: q.data.lessee.businessName ?? '',
                  contactNumber: q.data.lessee.contactNumber,
                  email: q.data.lessee.email ?? '',
                  address: q.data.lessee.address,
                  smsConsent: q.data.lessee.smsConsent,
                  notes: q.data.lessee.notes ?? '',
                }}
                onSubmit={(input) =>
                  update.mutate(
                    { id, input },
                    {
                      onSuccess: () => {
                        toast.success('Lessee updated.')
                        router.push(`/app/lessees/${id}`)
                      },
                    },
                  )
                }
              />
            </CardBody>
            <CardFooter>
              <Button variant="secondary" onClick={() => router.back()}>
                {t.common.cancel}
              </Button>
              <Button type="submit" form="edit-lessee" disabled={update.isPending}>
                {update.isPending ? t.common.saving : t.common.save}
              </Button>
            </CardFooter>
          </Card>
        </>
      )}
    </RoleGate>
  )
}
