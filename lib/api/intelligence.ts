import { Signal, SignalEvidence, SignalEntity, Evidence, Source, Entity } from '@/types/intelligence'

const API_BASE = '/api'

async function fetchApi<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const searchParams = new URLSearchParams(params)
  const response = await fetch(`${API_BASE}${endpoint}?${searchParams.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store'
  })
  if (!response.ok) throw new Error(`API error: ${response.status}`)
  return response.json()
}

export async function fetchSignals(params: {
  workspace_id: string
  domain_id?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<{ data: Signal[]; count: number }> {
  return fetchApi<{ data: Signal[]; count: number }>('/signals', {
    workspace_id: params.workspace_id,
    domain_id: params.domain_id || '',
    status: params.status || 'accepted',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0)
  })
}

export async function fetchSignalById(id: string, workspaceId: string): Promise<Signal | null> {
  const { data } = await fetchSignals({ workspace_id: workspaceId, limit: 100 })
  return data.find(s => s.id === id) || null
}

export async function fetchObservations(params: {
  workspace_id: string
  domain_id?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<{ data: any[]; count: number }> {
  return fetchApi<{ data: any[]; count: number }>('/observations', {
    workspace_id: params.workspace_id,
    domain_id: params.domain_id || '',
    status: params.status || 'accepted',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0)
  })
}

export async function fetchPatterns(params: {
  workspace_id: string
  domain_id?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<{ data: any[]; count: number }> {
  return fetchApi<{ data: any[]; count: number }>('/patterns', {
    workspace_id: params.workspace_id,
    domain_id: params.domain_id || '',
    status: params.status || '',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0)
  })
}

export async function fetchTheses(params: {
  workspace_id: string
  domain_id?: string
  thesis_type?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<{ data: any[]; count: number }> {
  return fetchApi<{ data: any[]; count: number }>('/theses', {
    workspace_id: params.workspace_id,
    domain_id: params.domain_id || '',
    thesis_type: params.thesis_type || '',
    status: params.status || '',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0)
  })
}

export async function fetchHypotheses(params: {
  workspace_id: string
  domain_id?: string
  status?: string
  origin?: string
  limit?: number
  offset?: number
}): Promise<{ data: any[]; count: number }> {
  return fetchApi<{ data: any[]; count: number }>('/hypotheses', {
    workspace_id: params.workspace_id,
    domain_id: params.domain_id || '',
    status: params.status || '',
    origin: params.origin || '',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0)
  })
}

export async function fetchValidations(params: {
  workspace_id: string
  domain_id?: string
  hypothesis_id?: string
  limit?: number
  offset?: number
}): Promise<{ data: any[]; count: number }> {
  return fetchApi<{ data: any[]; count: number }>('/validations', {
    workspace_id: params.workspace_id,
    domain_id: params.domain_id || '',
    hypothesis_id: params.hypothesis_id || '',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0)
  })
}

export async function fetchCapitalFlow(params: {
  workspace_id: string
  domain_id?: string
  entity_id?: string
  match_type?: string
  limit?: number
  offset?: number
}): Promise<{ data: any[]; count: number }> {
  return fetchApi<{ data: any[]; count: number }>('/capital-flow', {
    workspace_id: params.workspace_id,
    domain_id: params.domain_id || '',
    entity_id: params.entity_id || '',
    match_type: params.match_type || '',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0)
  })
}

export async function fetchCapitalDirectory(params: {
  workspace_id: string
  entity_type?: string
  activity_status?: string
  limit?: number
  offset?: number
}): Promise<{ data: any[]; count: number }> {
  return fetchApi<{ data: any[]; count: number }>('/capital-directory', {
    workspace_id: params.workspace_id,
    entity_type: params.entity_type || '',
    activity_status: params.activity_status || '',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0)
  })
}

export async function fetchQualitySnapshots(params: {
  workspace_id: string
  domain_id?: string
  limit?: number
  offset?: number
}): Promise<{ snapshots: any[]; recentRuns: any[]; count: number }> {
  return fetchApi<{ snapshots: any[]; recentRuns: any[]; count: number }>('/quality', {
    workspace_id: params.workspace_id,
    domain_id: params.domain_id || '',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0)
  })
}

export async function fetchEvidenceReviewQueue(params: {
  workspace_id: string
  domain_id?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<{ data: any[]; count: number }> {
  return fetchApi<{ data: any[]; count: number }>('/evidence-review', {
    workspace_id: params.workspace_id,
    domain_id: params.domain_id || '',
    status: params.status || '',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0)
  })
}

export async function submitEvidenceReview(action: {
  evidence_id: string
  decision: 'verified' | 'disputed' | 'rejected'
  reason: string | null
  request_id: string
}): Promise<any> {
  const response = await fetch('/api/evidence-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action)
  })
  if (!response.ok) throw new Error(`API error: ${response.status}`)
  return response.json()
}

export async function fetchInvestments(params: {
  workspace_id: string
  domain_id?: string
  limit?: number
  offset?: number
}): Promise<{ data: any[]; count: number }> {
  return fetchApi<{ data: any[]; count: number }>('/investments', {
    workspace_id: params.workspace_id,
    domain_id: params.domain_id || '',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0)
  })
}

export async function fetchNews(params: {
  workspace_id: string
  domain_id?: string
  limit?: number
  offset?: number
}): Promise<{ data: any[]; count: number }> {
  return fetchApi<{ data: any[]; count: number }>('/news', {
    workspace_id: params.workspace_id,
    domain_id: params.domain_id || '',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0),
  })
}
