import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { updateProject } from '../api'
import { AppCard, Button, Field, Input, SectionHeading, Textarea } from './ui'
import type { Project, ProjectInput } from '../types'

/// Everything that only affects the PRINTED INVOICE for this client: who it is
/// addressed to, how its number is built, the wording, and when they pay.
///
/// Its own card rather than more rows in Project Details, because these are set once
/// when the client is onboarded and then left alone, while Project Details is the form
/// you open to change a status or a date. Mixing the two made both harder to read.
///
/// The issuer and bank blocks are NOT here: they are the same on every invoice and
/// live once in Settings.
export function InvoicingCard({
  project,
  onSaved,
}: {
  project: Project
  onSaved: () => void
}) {
  const fields = {
    invoicePrefix: project.invoicePrefix,
    billTo: project.billTo,
    invoiceWorkDescription: project.invoiceWorkDescription,
    invoiceLineLabel: project.invoiceLineLabel,
    paymentDueDayOfMonth: project.paymentDueDayOfMonth,
    invoiceTermsNote: project.invoiceTermsNote,
  }

  const [draft, setDraft] = useState(fields)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reload after the parent refetches, so a save elsewhere on the page is picked up.
  useEffect(() => {
    setDraft(fields)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.invoicePrefix, project.billTo, project.invoiceWorkDescription,
      project.invoiceLineLabel, project.paymentDueDayOfMonth, project.invoiceTermsNote])

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const dirty = (Object.keys(draft) as Array<keyof typeof draft>)
    .some((k) => draft[k] !== fields[k])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      // Send the whole project: the update endpoint replaces the record rather than
      // patching it, so posting only these fields would blank everything else.
      const payload: ProjectInput = {
        clientId: project.clientId,
        clientName: project.clientName,
        projectName: project.projectName,
        platformId: project.platformId,
        currency: project.currency,
        feePercentage: project.feePercentage,
        initialFullPrice: project.initialFullPrice,
        status: project.status,
        dateAwarded: project.dateAwarded,
        dateCompleted: project.dateCompleted,
        notes: project.notes,
        billingType: project.billingType,
        cadence: project.cadence,
        committedHours: project.committedHours,
        files: project.files,
        ...draft,
      }
      await updateProject(project.id, payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the invoicing details.')
    } finally {
      setSaving(false)
    }
  }

  const prefix = draft.invoicePrefix?.trim().toUpperCase()
  const year = new Date().getFullYear()

  return (
    <AppCard>
      <SectionHeading
        title="Invoicing"
        description="How this client's invoices are numbered, addressed and worded. Set once, then left alone."
        action={
          <div className="flex items-center gap-3">
            {saved && <span className="text-xs" style={{ color: 'var(--accent)' }}>Saved</span>}
            <Button
              variant={dirty ? 'primary' : 'secondary'}
              className="text-xs"
              disabled={saving || !dirty}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 p-4">
        {error && (
          <div
            className="rounded-md px-4 py-3 text-sm"
            style={{ border: '1px solid #c9726430', background: '#c9726410', color: 'var(--overdue)' }}
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Bill to"
            hint="Printed instead of the client name. Usually the legal entity, not the person, or it stalls in their accounts payable. One line per line."
          >
            <Textarea
              rows={3}
              value={draft.billTo ?? ''}
              placeholder={'Operation Golden Rule, LLC\nDBA Outside Communications\nAttn: Lance Fisher, Managing Partner'}
              onChange={(e) => set('billTo', e.target.value || null)}
            />
          </Field>

          <Field
            label="Work performed"
            hint="The paragraph above the table. Copied onto each new invoice, so editing it never rewrites one already sent."
          >
            <Textarea
              rows={3}
              value={draft.invoiceWorkDescription ?? ''}
              placeholder="Systems engineering and data integration services under the Statement of Work dated 27 June 2026. Hours as logged in TSheets."
              onChange={(e) => set('invoiceWorkDescription', e.target.value || null)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Invoice prefix"
            hint={prefix ? `Numbers as ${prefix}-${year}-001.` : `Blank numbers as P${project.id}-${year}-001.`}
          >
            <Input
              value={draft.invoicePrefix ?? ''}
              placeholder="OC"
              onChange={(e) => set('invoicePrefix', e.target.value || null)}
            />
          </Field>

          <Field label="Line item" hint="What the table row is called.">
            <Input
              value={draft.invoiceLineLabel ?? ''}
              placeholder="Engineering services, hourly"
              onChange={(e) => set('invoiceLineLabel', e.target.value || null)}
            />
          </Field>

          <Field
            label="Pays on day of month"
            hint="Sets the due date to that day of the following month. For your own overdue tracking only, never printed on the invoice."
          >
            <Input
              type="number"
              min="1"
              max="31"
              value={draft.paymentDueDayOfMonth ?? ''}
              placeholder="20"
              onChange={(e) =>
                set('paymentDueDayOfMonth', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </Field>
        </div>

        <Field
          label="Terms note"
          hint="Optional. Printed word for word under the invoice date. Leave it blank and the invoice says nothing about when payment is due."
        >
          <Input
            value={draft.invoiceTermsNote ?? ''}
            placeholder="(nothing about payment timing)"
            onChange={(e) => set('invoiceTermsNote', e.target.value || null)}
          />
        </Field>

        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Your own name, address and bank details are the same on every invoice and live in{' '}
          <Link to="/settings" className="underline" style={{ color: 'var(--accent)' }}>
            Settings
          </Link>
          .
        </p>
      </div>
    </AppCard>
  )
}
