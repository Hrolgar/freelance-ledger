import { Field, Input, Select, Textarea } from './ui'
import type { ProjectInput } from '../types'

/// Billing type plus the hourly extras, shared by the Add Project modal and the
/// Project Details form. One component so the two cannot drift apart -- an hourly
/// project created without a cadence or prefix is a project you then have to go and
/// fix in the other form.
export function BillingFields({
  draft,
  onChange,
}: {
  draft: ProjectInput
  onChange: (patch: Partial<ProjectInput>) => void
}) {
  const hourly = draft.billingType === 'Hourly'

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Billing">
          <Select
            value={draft.billingType}
            onChange={(e) => {
              const billingType = e.target.value as ProjectInput['billingType']
              // Leaving hourly should not strand a cadence and committed hours that
              // nothing will read again.
              onChange(
                billingType === 'Hourly'
                  ? { billingType }
                  : { billingType, cadence: 'None', committedHours: null },
              )
            }}
          >
            <option value="Fixed">Fixed price</option>
            <option value="Hourly">Hourly</option>
          </Select>
        </Field>

        {hourly && (
          <>
            <Field label="Cadence">
              <Select
                value={draft.cadence}
                onChange={(e) => onChange({ cadence: e.target.value as ProjectInput['cadence'] })}
              >
                <option value="None">Ad hoc</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </Select>
            </Field>
            <Field label="Committed hours">
              <Input
                type="number"
                min="0"
                step="0.25"
                value={draft.committedHours ?? ''}
                onChange={(e) =>
                  onChange({ committedHours: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Invoice prefix">
              <Input
                value={draft.invoicePrefix ?? ''}
                placeholder="OC"
                onChange={(e) => onChange({ invoicePrefix: e.target.value || null })}
              />
            </Field>
          </>
        )}
      </div>

      {hourly && (
        <Field
          label="Bill to"
          hint="Printed on the invoice instead of the client name. Usually the legal entity, one line per line."
        >
          <Textarea
            rows={3}
            value={draft.billTo ?? ''}
            placeholder={'Operation Golden Rule, LLC\nDBA Outside Communications\nAttn: Lance Fisher, Managing Partner'}
            onChange={(e) => onChange({ billTo: e.target.value || null })}
          />
        </Field>
      )}
    </>
  )
}
