import { Field, Input, Select } from './ui'
import type { ProjectInput } from '../types'

/// How the project bills: fixed price, or hourly with a cadence and committed hours.
/// Shared by the Add Project modal and the Project Details form so the two cannot
/// drift apart.
///
/// Everything that only affects the PRINTED INVOICE -- who it is addressed to, the
/// number prefix, the wording -- lives in InvoicingCard instead. Those are set once
/// per client and then never touched, so they do not belong in the form you open to
/// change a status or a date.
export function BillingFields({
  draft,
  onChange,
}: {
  draft: ProjectInput
  onChange: (patch: Partial<ProjectInput>) => void
}) {
  const hourly = draft.billingType === 'Hourly'
  const retainer = draft.billingType === 'Retainer'

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Billing">
          <Select
            value={draft.billingType}
            onChange={(e) => {
              const billingType = e.target.value as ProjectInput['billingType']
              // Clear whichever side no longer applies, so nothing stale is left
              // feeding a derived display. An initially quoted total means nothing
              // on an hourly or retainer project. A cadence and committed hours are
              // an hourly idea; a retainer is monthly by definition, not a choice.
              onChange(
                billingType === 'Hourly'
                  ? { billingType, initialFullPrice: null }
                  : billingType === 'Retainer'
                    ? { billingType, initialFullPrice: null, cadence: 'Monthly', committedHours: null }
                    : { billingType, cadence: 'None', committedHours: null },
              )
            }}
          >
            <option value="Fixed">Fixed price</option>
            <option value="Hourly">Hourly</option>
            <option value="Retainer">Monthly retainer</option>
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
          </>
        )}
      </div>

      {/* Neither cadence nor committed hours is a choice on a retainer -- it is monthly
          and worth whatever the fee history below says, not a per-period number. The
          obvious next question here is "where do I type the amount", so answer it. */}
      {retainer && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          The monthly fee is set in the retainer panel below, not here.
        </p>
      )}
    </>
  )
}
