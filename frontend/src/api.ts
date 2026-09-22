import type {
  Client,
  ClientInput,
  Cost,
  CostInput,
  EffectiveCost,
  ExchangeRate,
  Investment,
  InvestmentInput,
  CreateInvoiceRequest,
  GenerateEntriesRequest,
  GenerateEntriesResult,
  InvoiceProfile,
  Milestone,
  MilestoneInput,
  MilestonePatchRequest,
  Pipeline,
  ProjectRate,
  ProjectRateInput,
  RetainerPeriods,
  TimeEntry,
  TimeEntryInput,
  Platform,
  PlatformInput,
  Project,
  ProjectFile,
  ProjectInput,
  ProjectSummary,
  Tip,
  TipInput,
  VatSummary,
  YearOverview,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

let reauthing = false

function triggerReauth(): void {
  if (reauthing) return
  reauthing = true
  window.location.assign(
    '/outpost.goauthentik.io/start?rd=' + encodeURIComponent(window.location.href),
  )
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
    redirect: 'manual',
  })

  if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) {
    triggerReauth()
    throw new Error('Your session expired — signing you back in…')
  }

  if (!response.ok) {
    const fallback = `Request failed with status ${response.status}`
    let message = fallback

    // The throw used to live inside the try, so its own Error was caught by the
    // catch below and every API message got replaced by the bare status line.
    try {
      const problem = (await response.json()) as { title?: string; detail?: string }
      message = problem.detail ?? problem.title ?? fallback
    } catch {
      // Not a ProblemDetails body. The status line is all we have.
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  })

  const value = search.toString()
  return value ? `?${value}` : ''
}

// Platforms
export const getPlatforms = () => request<Platform[]>('/platforms')
export const createPlatform = (data: PlatformInput) =>
  request<Platform>('/platforms', { method: 'POST', body: JSON.stringify(data) })
export const updatePlatform = (id: number, data: PlatformInput) =>
  request<Platform>(`/platforms/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deletePlatform = (id: number) => request<void>(`/platforms/${id}`, { method: 'DELETE' })

// Clients
export const getClients = () => request<Client[]>('/clients')
export const getClient = (id: number) => request<Client>(`/clients/${id}`)
export const createClient = (data: ClientInput) =>
  request<Client>('/clients', { method: 'POST', body: JSON.stringify(data) })
export const updateClient = (id: number, data: ClientInput) =>
  request<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteClient = (id: number) => request<void>(`/clients/${id}`, { method: 'DELETE' })

export const getYearOverview = (year: number) => request<YearOverview>(`/dashboard/year-overview${query({ year })}`)

export const getPipeline = () => request<Pipeline>('/dashboard/pipeline')

export const getVatSummary = (year: number) => request<VatSummary>(`/dashboard/vat${query({ year })}`)

export const getProjects = () => request<Project[]>('/projects')
export const getProject = (id: number) => request<Project>(`/projects/${id}`)
export const getProjectSummary = (id: number) => request<ProjectSummary>(`/projects/${id}/summary`)
export const createProject = (data: ProjectInput) =>
  request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) })
export const updateProject = (id: number, data: ProjectInput) =>
  request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteProject = (id: number) => request<void>(`/projects/${id}`, { method: 'DELETE' })

export const createMilestone = (projectId: number, data: MilestoneInput) =>
  request<Milestone>(`/projects/${projectId}/milestones`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
export const updateMilestone = (projectId: number, id: number, data: MilestoneInput) =>
  request<Milestone>(`/projects/${projectId}/milestones/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
export const patchMilestone = (id: number, data: MilestonePatchRequest) =>
  request<Milestone>(`/milestones/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
export const deleteMilestone = (projectId: number, id: number) =>
  request<void>(`/projects/${projectId}/milestones/${id}`, { method: 'DELETE' })

export const createTip = (projectId: number, data: TipInput) =>
  request<Tip>(`/projects/${projectId}/tips`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
export const updateTip = (projectId: number, id: number, data: TipInput) =>
  request<Tip>(`/projects/${projectId}/tips/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
export const deleteTip = (projectId: number, id: number) =>
  request<void>(`/projects/${projectId}/tips/${id}`, { method: 'DELETE' })

export const getCosts = () => request<Cost[]>('/costs')
export const getEffectiveCosts = (month: number, year: number) =>
  request<EffectiveCost[]>(`/costs/effective${query({ month, year })}`)
export const createCost = (data: CostInput) =>
  request<Cost>('/costs', { method: 'POST', body: JSON.stringify(data) })
export const updateCost = (id: number, data: CostInput) =>
  request<Cost>(`/costs/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteCost = (id: number) => request<void>(`/costs/${id}`, { method: 'DELETE' })

export const getInvestments = (params?: { year?: number }) =>
  request<Investment[]>(`/investments${query(params ?? {})}`)
export const createInvestment = (data: InvestmentInput) =>
  request<Investment>('/investments', { method: 'POST', body: JSON.stringify(data) })
export const updateInvestment = (id: number, data: InvestmentInput) =>
  request<Investment>(`/investments/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteInvestment = (id: number) =>
  request<void>(`/investments/${id}`, { method: 'DELETE' })

export const getExchangeRates = (params?: { month?: number; year?: number }) =>
  request<ExchangeRate[]>(`/exchange-rates${query(params ?? {})}`)
export const autoFetchRates = (month: number, year: number) =>
  request<ExchangeRate[]>(`/exchange-rates/auto-fetch${query({ month, year })}`, { method: 'POST' })

export const getProjectFiles = (projectId: number) =>
  request<ProjectFile[]>(`/projects/${projectId}/files`)

export const uploadProjectFile = async (projectId: number, file: File): Promise<ProjectFile> => {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(`${API_BASE}/projects/${projectId}/files`, {
    method: 'POST',
    body: form,
    redirect: 'manual',
  })
  if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) {
    triggerReauth()
    throw new Error('Your session expired — signing you back in…')
  }
  if (!response.ok) {
    let message = `Upload failed with status ${response.status}`
    try {
      const problem = (await response.json()) as { title?: string; detail?: string }
      message = problem.detail ?? problem.title ?? message
    } catch {
      // Not a ProblemDetails body.
    }
    throw new Error(message)
  }
  return await response.json() as ProjectFile
}

/// Fetches a file through the same session handling as every other request and hands
/// it to the browser as a download. A bare <a target=_blank> or window.open bypasses
/// the reauth logic, so an expired session saved the login page as the file.
export const downloadFile = async (url: string, filename: string): Promise<void> => {
  const response = await fetch(url, { redirect: 'manual' })
  if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) {
    triggerReauth()
    throw new Error('Your session expired — signing you back in…')
  }
  if (!response.ok) {
    let message = `Download failed with status ${response.status}`
    try {
      const problem = (await response.json()) as { title?: string; detail?: string }
      message = problem.detail ?? problem.title ?? message
    } catch {
      // Not a ProblemDetails body.
    }
    throw new Error(message)
  }
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000)
}

export const deleteProjectFile = (projectId: number, fileId: number) =>
  request<void>(`/projects/${projectId}/files/${fileId}`, { method: 'DELETE' })

export const projectFileDownloadUrl = (projectId: number, fileId: number, inline = false) =>
  `${API_BASE}/projects/${projectId}/files/${fileId}/download${inline ? '?inline=true' : ''}`

// --- Hourly billing ---

export const getProjectRates = (projectId: number) =>
  request<ProjectRate[]>(`/projects/${projectId}/rates`)

export const createProjectRate = (projectId: number, input: ProjectRateInput) =>
  request<ProjectRate>(`/projects/${projectId}/rates`, {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const updateProjectRate = (projectId: number, id: number, input: ProjectRateInput) =>
  request<ProjectRate>(`/projects/${projectId}/rates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })

export const deleteProjectRate = (projectId: number, id: number) =>
  request<void>(`/projects/${projectId}/rates/${id}`, { method: 'DELETE' })

// --- Retainer billing ---

export const getRetainerPeriods = (
  projectId: number,
  opts?: { from?: string; to?: string },
) => request<RetainerPeriods>(`/projects/${projectId}/retainer/periods${query(opts ?? {})}`)

export const getTimeEntries = (
  projectId: number,
  opts?: { from?: string; to?: string; unbilledOnly?: boolean },
) => request<TimeEntry[]>(`/projects/${projectId}/time-entries${query(opts ?? {})}`)

export const createTimeEntry = (projectId: number, input: TimeEntryInput) =>
  request<TimeEntry>(`/projects/${projectId}/time-entries`, {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const updateTimeEntry = (projectId: number, id: number, input: TimeEntryInput) =>
  request<TimeEntry>(`/projects/${projectId}/time-entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })

export const deleteTimeEntry = (projectId: number, id: number) =>
  request<void>(`/projects/${projectId}/time-entries/${id}`, { method: 'DELETE' })

export const generateTimeEntries = (projectId: number, input: GenerateEntriesRequest) =>
  request<GenerateEntriesResult>(`/projects/${projectId}/time-entries/generate`, {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const getInvoices = (projectId: number) =>
  request<Milestone[]>(`/projects/${projectId}/invoices`)


export const createInvoice = (projectId: number, input: CreateInvoiceRequest) =>
  request<{ invoice: Milestone; periods: number; totalHours: number | null }>(
    `/projects/${projectId}/invoices`,
    { method: 'POST', body: JSON.stringify(input) },
  )

export const deleteInvoice = (projectId: number, id: number) =>
  request<{ released: number }>(`/projects/${projectId}/invoices/${id}`, { method: 'DELETE' })

export const invoicePdfUrl = (projectId: number, id: number) =>
  `${API_BASE}/projects/${projectId}/invoices/${id}/pdf`

export const invoiceMarkdownUrl = (projectId: number, id: number) =>
  `${API_BASE}/projects/${projectId}/invoices/${id}/markdown`

export const getInvoiceProfile = () => request<InvoiceProfile>('/invoice-profile')

export const saveInvoiceProfile = (input: InvoiceProfile) =>
  request<InvoiceProfile>('/invoice-profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

/// Downloads through fetch rather than a bare link so an expired Authentik session
/// triggers reauth instead of silently rendering the login page as a broken file.
export const downloadInvoice = async (
  projectId: number,
  id: number,
  format: 'pdf' | 'markdown',
  filename: string,
): Promise<void> => {
  const url = format === 'pdf' ? invoicePdfUrl(projectId, id) : invoiceMarkdownUrl(projectId, id)
  const response = await fetch(url, { redirect: 'manual' })

  if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) {
    triggerReauth()
    throw new Error('Your session expired — signing you back in…')
  }

  if (!response.ok) {
    let message = `Download failed with status ${response.status}`
    try {
      const problem = (await response.json()) as { title?: string; detail?: string }
      message = problem.detail ?? problem.title ?? message
    } catch {
      /* not a problem document */
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
