import type {
  Client,
  ClientInput,
  Cost,
  CostInput,
  EffectiveCost,
  ExchangeRate,
  ExchangeRateInput,
  Investment,
  InvestmentInput,
  Milestone,
  MilestoneInput,
  MilestonePatchRequest,
  Pipeline,
  Platform,
  PlatformInput,
  Project,
  ProjectFile,
  ProjectInput,
  ProjectSummary,
  Tip,
  TipInput,
  YearOverview,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const fallback = `Request failed with status ${response.status}`

    try {
      const problem = (await response.json()) as { title?: string; detail?: string }
      throw new Error(problem.detail ?? problem.title ?? fallback)
    } catch {
      throw new Error(fallback)
    }
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function query(params: Record<string, string | number | undefined>) {
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
export const getPlatform = (id: number) => request<Platform>(`/platforms/${id}`)
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

export const getDashboardYear = (year: number) =>
  request<YearOverview>(`/dashboard/year-overview${query({ year })}`)
export const getYearOverview = getDashboardYear

export const getPipeline = () => request<Pipeline>('/dashboard/pipeline')

export const getProjects = () => request<Project[]>('/projects')
export const getProject = (id: number) => request<Project>(`/projects/${id}`)
export const getProjectSummary = (id: number) => request<ProjectSummary>(`/projects/${id}/summary`)
export const createProject = (data: ProjectInput) =>
  request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) })
export const updateProject = (id: number, data: ProjectInput) =>
  request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteProject = (id: number) => request<void>(`/projects/${id}`, { method: 'DELETE' })

export const getMilestones = (projectId: number) => request<Milestone[]>(`/projects/${projectId}/milestones`)
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

export const getTips = (projectId: number) => request<Tip[]>(`/projects/${projectId}/tips`)
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
export const createExchangeRate = (data: ExchangeRateInput) =>
  request<ExchangeRate>('/exchange-rates', { method: 'POST', body: JSON.stringify(data) })
export const upsertExchangeRate = (data: ExchangeRateInput) =>
  request<ExchangeRate>('/exchange-rates', { method: 'PUT', body: JSON.stringify(data) })
export const deleteExchangeRate = (id: number) =>
  request<void>(`/exchange-rates/${id}`, { method: 'DELETE' })
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
  })
  if (!response.ok) {
    const txt = await response.text().catch(() => 'Upload failed')
    throw new Error(txt || 'Upload failed')
  }
  return await response.json() as ProjectFile
}

export const deleteProjectFile = (projectId: number, fileId: number) =>
  request<void>(`/projects/${projectId}/files/${fileId}`, { method: 'DELETE' })

export const projectFileDownloadUrl = (projectId: number, fileId: number, inline = false) =>
  `${API_BASE}/projects/${projectId}/files/${fileId}/download${inline ? '?inline=true' : ''}`

export const api = {
  getPlatforms,
  getPlatform,
  createPlatform,
  updatePlatform,
  deletePlatform,
  getDashboardYear,
  getYearOverview,
  getPipeline,
  getProjects,
  getProject,
  getProjectSummary,
  createProject,
  updateProject,
  deleteProject,
  getMilestones,
  createMilestone,
  updateMilestone,
  patchMilestone,
  deleteMilestone,
  getTips,
  createTip,
  updateTip,
  deleteTip,
  getCosts,
  createCost,
  updateCost,
  deleteCost,
  getInvestments,
  createInvestment,
  updateInvestment,
  deleteInvestment,
  getExchangeRates,
  createExchangeRate,
  upsertExchangeRate,
  deleteExchangeRate,
}
