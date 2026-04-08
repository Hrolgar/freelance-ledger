export type Platform = 'Freelancer' | 'Upwork' | 'Direct' | 'Other'
export type Currency = 'GBP' | 'USD' | 'EUR' | 'CAD' | 'INR' | 'NOK'
export type ProjectStatus = 'Quoted' | 'Awarded' | 'InProgress' | 'Completed' | 'Paid'
export type MilestoneStatus = 'Pending' | 'Funded' | 'Released' | 'Paid' | 'Disputed'
export type CostCategory = 'Software' | 'Hardware' | 'Internet' | 'Office' | 'Other'

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

export interface Project {
  id: number
  clientId: number | null
  clientName: string
  projectName: string
  platform: Platform
  currency: Currency
  feePercentage: number
  status: ProjectStatus
  dateAwarded: string | null
  dateCompleted: string | null
  notes: string | null
  milestones: Milestone[]
  tips: Tip[]
}

export interface Milestone {
  id: number
  projectId: number
  name: string
  description: string | null
  amount: number
  currency: Currency
  status: MilestoneStatus
  dateDue: string | null
  datePaid: string | null
  sortOrder: number
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
  currency: Currency
  grossValue: number
  netValue: number
}

export interface Pipeline {
  totalPipelineValue: number
  projects: PipelineProject[]
}

export interface ProjectSummary {
  projectId: number
  paidMilestoneTotal: number
  tipTotal: number
  gross: number
  fee: number
  net: number
  currency: Currency
}

export type ProjectInput = Omit<Project, 'id' | 'milestones' | 'tips'>
export type MilestoneInput = Omit<Milestone, 'id' | 'projectId'>
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
}

export const CURRENCIES: Currency[] = ['GBP', 'USD', 'EUR', 'CAD', 'INR', 'NOK']
export const PLATFORMS: Platform[] = ['Freelancer', 'Upwork', 'Direct', 'Other']
export const PROJECT_STATUSES: ProjectStatus[] = [
  'Quoted',
  'Awarded',
  'InProgress',
  'Completed',
  'Paid',
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

export const currencies = CURRENCIES
export const platforms = PLATFORMS
export const projectStatuses = PROJECT_STATUSES
export const milestoneStatuses = MILESTONE_STATUSES
export const costCategories = COST_CATEGORIES
export const monthNames = MONTH_NAMES
