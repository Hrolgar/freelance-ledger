import { useEffect, useState } from 'react'
import { getInvoiceProfile, saveInvoiceProfile } from '../api'
import { AppCard, Button, Field, Input, SectionHeading, Textarea } from './ui'
import type { InvoiceProfile } from '../types'

const empty: InvoiceProfile = {
  issuerName: '',
  issuerAddressLine1: null,
  issuerAddressLine2: null,
  issuerCountry: null,
  issuerEmail: null,
  orgNumber: null,
  accountHolder: null,
  bankName: null,
  iban: null,
  bicSwift: null,
  paymentNotes: null,
  vatNote: null,
  termsNote: null,
  defaultVatRate: null,
}

/// The "from" and payment blocks printed on every generated invoice. Stored in the
/// database rather than the repo, since it holds bank details and the repo is public.
export function InvoiceProfileCard() {
  const [profile, setProfile] = useState<InvoiceProfile>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const data = await getInvoiceProfile()
        setProfile({ ...empty, ...data })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load the invoice profile')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const set = (key: keyof InvoiceProfile) => (value: string) =>
    setProfile((p) => ({ ...p, [key]: value || null }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const result = await saveInvoiceProfile(profile)
      setProfile({ ...empty, ...result })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppCard>
      <SectionHeading
        title="Invoice details"
        description="Printed on every generated invoice. Bank details live here rather than in the code."
      />
      {loading ? (
        <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>
      ) : (
        <div className="grid gap-3 p-4">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Your name">
              <Input value={profile.issuerName} onChange={(e) => setProfile((p) => ({ ...p, issuerName: e.target.value }))} />
            </Field>
            <Field label="Email">
              <Input value={profile.issuerEmail ?? ''} onChange={(e) => set('issuerEmail')(e.target.value)} />
            </Field>
            <Field label="Address line 1">
              <Input value={profile.issuerAddressLine1 ?? ''} onChange={(e) => set('issuerAddressLine1')(e.target.value)} />
            </Field>
            <Field label="Address line 2">
              <Input value={profile.issuerAddressLine2 ?? ''} onChange={(e) => set('issuerAddressLine2')(e.target.value)} />
            </Field>
            <Field label="Country">
              <Input value={profile.issuerCountry ?? ''} onChange={(e) => set('issuerCountry')(e.target.value)} />
            </Field>
            <Field
              label="Organisation number"
              hint="Printed as Org.nr. … MVA on invoices that charge VAT."
            >
              <Input value={profile.orgNumber ?? ''} onChange={(e) => set('orgNumber')(e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Account holder">
              <Input value={profile.accountHolder ?? ''} onChange={(e) => set('accountHolder')(e.target.value)} />
            </Field>
            <Field label="Bank">
              <Input value={profile.bankName ?? ''} onChange={(e) => set('bankName')(e.target.value)} />
            </Field>
            <Field label="IBAN">
              <Input value={profile.iban ?? ''} onChange={(e) => set('iban')(e.target.value)} />
            </Field>
            <Field label="BIC / SWIFT">
              <Input value={profile.bicSwift ?? ''} onChange={(e) => set('bicSwift')(e.target.value)} />
            </Field>
          </div>

          <Field label="Payment terms" hint="One sentence under the invoice date.">
            <Input value={profile.termsNote ?? ''} onChange={(e) => set('termsNote')(e.target.value)} />
          </Field>
          <Field label="Payment note" hint="Printed above the bank table.">
            <Textarea rows={2} value={profile.paymentNotes ?? ''} onChange={(e) => set('paymentNotes')(e.target.value)} />
          </Field>
          <Field label="VAT note" hint="Why no VAT is charged. Printed verbatim.">
            <Textarea rows={2} value={profile.vatNote ?? ''} onChange={(e) => set('vatNote')(e.target.value)} />
          </Field>
          <Field
            label="Default VAT rate %"
            hint="Only a prefill for new projects. What actually gets charged is each project's own VAT rate, set on its Invoicing card."
          >
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={profile.defaultVatRate ?? ''}
              placeholder="blank = no VAT charged"
              onChange={(e) =>
                setProfile((p) => ({ ...p, defaultVatRate: e.target.value === '' ? null : Number(e.target.value) }))
              }
            />
          </Field>

          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-[var(--accent)]">Saved</span>}
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </AppCard>
  )
}
