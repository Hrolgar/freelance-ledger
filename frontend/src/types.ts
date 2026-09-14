export type Currency = 'GBP' | 'USD' | 'EUR' | 'CAD' | 'INR' | 'NOK'
export type ProjectStatus = 'Quoted' | 'Awarded' | 'InProgress' | 'Completed' | 'Paid' | 'OnHold'
export type MilestoneStatus = 'Pending' | 'Funded' | 'Released' | 'Paid' | 'Disputed'
export type CostCategory = 'Software' | 'Hardware' | 'Internet' | 'Office' | 'Other' | 'Marketing'
export type InvestmentCategory = 'Hardware' | 'Education' | 'Certification' | 'Equipment' | 'Other'

export interface Platform {
  id: number
  name: string
  defaultFeePercentage: number
  isLocked: boolean
  notes: string | null
}

export type PlatformInput = Omit<Platform, 'id'>

export interface Client {
  id: number
  name: string
  email: string | null
  phone: string | null
  country: string | null
  timezone: string | null
  freelancerId: string | null
  upworkId: string | null
  notes: string | null
  aliases: string | null
  projects: Project[]
}

export type ClientInput = Omit<Client, 'id' | 'projects'>

export interface ProjectFile {
  id: number
  projectId: number
  originalFilename: string
  contentType: string
  sizeBytes: number
  storageKey: string
  uploadedAt: string
  /// Set when the file was filed automatically by raising an invoice.
  sourceInvoiceMilestoneId: number | null
}

export interface Project {
  id: number
  clientId: number | null
  client: Client | null
  clientName: string
  projectName: string
  platformId: number | null
  platform: Platform | null
  currency: Currency
  feePercentage: number
  initialFullPrice: number | null
  status: ProjectStatus
  dateAwarded: string | null
  dateCompleted: string | null
  notes: string | null
  billingType: BillingType
  invoicePrefix: string | null
  billTo: string | null
  invoiceWorkDescription: string | null
  invoiceLineLabel: string | null
  paymentDueDayOfMonth: number | null
  invoiceTermsNote: string | null
  cadence: HoursCadence
  committedHours: number | null
  // percent; null = no VAT charged (see the VAT note in Settings), 0 = explicitly zero-rated.
  vatRate: number | null
  // Retainer only: whether a period's invoice is raised automatically once the month ends.
  autoRaiseInvoice: boolean
  // null = automatic: Norwegian when vatRate is set, English otherwise.
  invoiceLanguage: 'English' | 'Norwegian' | null
  milestones: Milestone[]
  tips: Tip[]
  files: ProjectFile[]
}

export type BillingType = 'Fixed' | 'Hourly' | 'Retainer'
export type HoursCadence = 'None' | 'Weekly' | 'Monthly'

/// One calendar month of a retainer project. The server, not the browser, resolves which
/// fee is in force for the month -- that is what `fee` carries. Re-deriving it client-side
/// from the rate history is how the two answers drift apart on the month a fee changes.
export interface RetainerPeriod {
  periodStart: string
  periodEnd: string
  fee: number | null
  currency: Currency | null
  invoiceMilestoneId: number | null
  invoiceNumber: string | null
  status: MilestoneStatus | null
}

/// The months the server returned, plus where the retainer actually begins.
///
/// `firstMonth` is the month of the earliest fee, and it is what bounds the year
/// selector: a retainer that started in August 2026 has no 2025 to page back to. It is
/// null until a fee exists, at which point there is nothing to show at all.
export interface RetainerPeriods {
  firstMonth: string | null
  months: RetainerPeriod[]
}

export interface ProjectRate {
  id: number
  projectId: number
  rate: number
  currency: Currency
  effectiveFrom: string
  notes: string | null
}

export interface ProjectRateInput {
  rate: number
  currency: Currency
  effectiveFrom: string
  notes?: string | null
}

export interface TimeEntry {
  id: number
  projectId: number
  periodStart: string
  periodEnd: string
  hours: number
  notes: string | null
  rateApplied: number
  currency: Currency
  invoiceMilestoneId: number | null
  amount: number
}

export interface TimeEntryInput {
  periodStart: string
  periodEnd?: string
  hours: number
  notes?: string | null
  rateApplied?: number
  currency?: Currency
}

export interface GenerateEntriesRequest {
  from: string
  to: string
  hours?: number | null
  notes?: string | null
}

export interface GenerateEntriesResult {
  created: number
  skipped: string[]
  entries: TimeEntry[]
}

export interface CreateInvoiceRequest {
  from: string
  to: string
  invoiceNumber?: string | null
  name?: string | null
  description?: string | null
  dateDue?: string | null
  invoiceDate?: string | null
}

export interface InvoiceDetail {
  invoice: Milestone
  entries: TimeEntry[]
}

export interface InvoiceProfile {
  id?: number
  issuerName: string
  issuerAddressLine1: string | null
  issuerAddressLine2: string | null
  issuerCountry: string | null
  issuerEmail: string | null
  orgNumber: string | null
  accountHolder: string | null
  bankName: string | null
  iban: string | null
  bicSwift: string | null
  paymentNotes: string | null
  vatNote: string | null
  termsNote: string | null
  // Prefill only, for new projects. The rate actually charged is the project's own vatRate.
  defaultVatRate: number | null
}

export interface Milestone {
  id: number
  projectId: number
  name: string
  description: string | null
  // The NET figure. Every revenue stat in the app counts this one, VAT or not.
  amount: number
  currency: Currency
  status: MilestoneStatus
  dateDue: string | null
  datePaid: string | null
  sortOrder: number
  // Present only when the milestone is a generated hourly invoice.
  hours: number | null
  rateApplied: number | null
  periodStart: string | null
  periodEnd: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  vatRate: number | null
  vatAmount: number | null
  // = amount + (vatAmount ?? 0), computed server-side.
  totalDue: number
}

export interface Tip {
  id: number
  projectId: number
  amount: number
  currency: Currency
  date: string
  notes: string | null
}

export interface Cost {
  id: number
  description: string
  amount: number
  currency: Currency
  category: CostCategory
  month: number
  year: number
  recurring: boolean
  endMonth: number | null
  endYear: number | null
  notes: string | null
}

export interface EffectiveCost extends Cost {
  amountNok: number
}

export interface Investment {
  id: number
  description: string
  amount: number
  currency: Currency
  nokRate: number
  month: number
  year: number
  notes: string | null
  category: InvestmentCategory
}

export interface ExchangeRate {
  id: number
  currency: Currency
  month: number
  year: number
  rate: number
}

export interface MonthlyOverview {
  month: number
  revenue: number
  costs: number
  profit: number
}

export interface YearOverview {
  year: number
  totalRevenue: number
  totalCosts: number
  totalProfit: number
  months: MonthlyOverview[]
}

export interface PipelineProject {
  projectId: number
  clientName: string
  projectName: string
  status: ProjectStatus
  billingType: BillingType
  currency: Currency
  grossValue: number
  netValue: number
  unpaidGross: number
  unpaidNet: number
}

export interface Pipeline {
  totalPipelineValue: number       // = unpaid net total
  totalPipelineGrossValue: number  // = unpaid gross total
  projects: PipelineProject[]
  byStatus: Partial<Record<ProjectStatus, number>>
  onHoldCount: number
}

export interface ProjectSummary {
  projectId: number
  paidMilestoneTotal: number
  tipTotal: number
  gross: number
  fee: number
  net: number
  pipelineTotal: number
  outstanding: number
  outstandingNet: number
  initialFullPrice: number | null
  currency: Currency
}

export type ProjectInput = Omit<Project, 'id' | 'milestones' | 'tips' | 'client' | 'platform'> & { platformId: number | null }
// The invoice fields are only ever set by the server when generating an invoice, so
// creating an ordinary milestone by hand does not have to supply them. vatRate/vatAmount/
// totalDue are the same story: the server stamps them from the project's VAT rate.
type MilestoneInvoiceFields =
  | 'hours' | 'rateApplied' | 'periodStart' | 'periodEnd' | 'invoiceNumber' | 'invoiceDate'
  | 'vatRate' | 'vatAmount' | 'totalDue'
export type MilestoneInput = Omit<Milestone, 'id' | 'projectId' | MilestoneInvoiceFields> &
  Partial<Pick<Milestone, MilestoneInvoiceFields>>
export type TipInput = Omit<Tip, 'id' | 'projectId'>
export type CostInput = Omit<Cost, 'id'>
export type CostPayloadFixed = CostInput
export type InvestmentInput = Omit<Investment, 'id'>
export type ExchangeRateInput = Omit<ExchangeRate, 'id'>

export type ProjectPayload = ProjectInput
export type MilestonePayload = MilestoneInput
export type TipPayload = TipInput
export type CostPayload = CostInput
export type InvestmentPayload = InvestmentInput
export type ExchangeRatePayload = ExchangeRateInput

export interface MilestonePatchRequest {
  status?: MilestoneStatus
  datePaid?: string | null
  dateDue?: string | null
}

export const CURRENCIES: Currency[] = ['GBP', 'USD', 'EUR', 'CAD', 'INR', 'NOK']
/// The only two that mean anything on a retainer: it is running, or it has stopped.
/// Same stored values as everywhere else -- see projectStatusLabel for the wording.
export const RETAINER_STATUSES: ProjectStatus[] = ['InProgress', 'OnHold', 'Completed']

export const PROJECT_STATUSES: ProjectStatus[] = [
  'Quoted',
  'Awarded',
  'InProgress',
  'Completed',
  'Paid',
  'OnHold',
]
export const MILESTONE_STATUSES: MilestoneStatus[] = [
  'Pending',
  'Funded',
  'Released',
  'Paid',
  'Disputed',
]
export const COST_CATEGORIES: CostCategory[] = [
  'Software',
  'Hardware',
  'Internet',
  'Office',
  'Other',
  'Marketing',
]

export const COST_CATEGORIES_UI: CostCategory[] = [
  'Software',
  'Internet',
  'Office',
  'Marketing',
  'Other',
]

export const INVESTMENT_CATEGORIES: InvestmentCategory[] = [
  'Hardware',
  'Education',
  'Certification',
  'Equipment',
  'Other',
]
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_FULL_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const TIMEZONES = [
  'Africa/Accra',
  'Africa/Addis_Ababa',
  'Africa/Algiers',
  'Africa/Cairo',
  'Africa/Casablanca',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Caracas',
  'America/Chicago',
  'America/Denver',
  'America/Halifax',
  'America/Lima',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Almaty',
  'Asia/Baku',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Ho_Chi_Minh',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Jerusalem',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Asia/Manila',
  'Asia/Riyadh',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Taipei',
  'Asia/Tashkent',
  'Asia/Tbilisi',
  'Asia/Tehran',
  'Asia/Tokyo',
  'Asia/Yerevan',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Bucharest',
  'Europe/Dublin',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Europe/Kyiv',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Oslo',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Guam',
  'Pacific/Honolulu',
]

export const currencies = CURRENCIES
export const projectStatuses = PROJECT_STATUSES
export const milestoneStatuses = MILESTONE_STATUSES
export const costCategories = COST_CATEGORIES
export const monthNames = MONTH_NAMES
