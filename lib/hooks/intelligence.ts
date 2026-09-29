'use client'

import useSWR from 'swr'
import { fetchSignals, fetchObservations, fetchPatterns, fetchTheses, fetchHypotheses, fetchValidations, fetchCapitalFlow, fetchCapitalDirectory, fetchQualitySnapshots, fetchEvidenceReviewQueue, fetchInvestments } from '@/lib/api/intelligence'
import { Signal, Observation, Pattern, Thesis, Hypothesis, ValidationRun, CapitalFlowMapping, CapitalDirectoryEntry, QualitySnapshot } from '@/types/intelligence'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useSignals(workspaceId: string, domainId?: string, status = 'accepted', limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<{ data: any[]; count: number }>(
    workspaceId ? `/api/signals?workspace_id=${workspaceId}&domain_id=${domainId || ''}&status=${status}&limit=${limit}` : null,
    fetcher
  )
  return {
    signals: (data?.data as any[]) || [],
    count: data?.count || 0,
    isLoading,
    error,
    mutate
  }
}

export function useObservations(workspaceId: string, domainId?: string, status = 'accepted', limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<{ data: any[]; count: number }>(
    workspaceId ? `/api/observations?workspace_id=${workspaceId}&domain_id=${domainId || ''}&status=${status}&limit=${limit}` : null,
    fetcher
  )
  return {
    observations: (data?.data as any[]) || [],
    count: data?.count || 0,
    isLoading,
    error,
    mutate
  }
}

export function usePatterns(workspaceId: string, domainId?: string, status?: string, limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<{ data: any[]; count: number }>(
    workspaceId ? `/api/patterns?workspace_id=${workspaceId}&domain_id=${domainId || ''}${status ? `&status=${status}` : ''}&limit=${limit}` : null,
    fetcher
  )
  return {
    patterns: (data?.data as any[]) || [],
    count: data?.count || 0,
    isLoading,
    error,
    mutate
  }
}

export function useTheses(workspaceId: string, domainId?: string, thesisType?: string, status?: string, limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<{ data: any[]; count: number }>(
    workspaceId ? `/api/theses?workspace_id=${workspaceId}&domain_id=${domainId || ''}${thesisType ? `&thesis_type=${thesisType}` : ''}${status ? `&status=${status}` : ''}&limit=${limit}` : null,
    fetcher
  )
  return {
    theses: (data?.data as any[]) || [],
    count: data?.count || 0,
    isLoading,
    error,
    mutate
  }
}

export function useHypotheses(workspaceId: string, domainId?: string, status?: string, origin?: string, limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<{ data: any[]; count: number }>(
    workspaceId ? `/api/hypotheses?workspace_id=${workspaceId}&domain_id=${domainId || ''}${status ? `&status=${status}` : ''}${origin ? `&origin=${origin}` : ''}&limit=${limit}` : null,
    fetcher
  )
  return {
    hypotheses: (data?.data as any[]) || [],
    count: data?.count || 0,
    isLoading,
    error,
    mutate
  }
}

export function useValidations(workspaceId: string, domainId?: string, hypothesisId?: string, limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<{ data: any[]; count: number }>(
    workspaceId ? `/api/validations?workspace_id=${workspaceId}&domain_id=${domainId || ''}${hypothesisId ? `&hypothesis_id=${hypothesisId}` : ''}&limit=${limit}` : null,
    fetcher
  )
  return {
    validations: (data?.data as any[]) || [],
    count: data?.count || 0,
    isLoading,
    error,
    mutate
  }
}

export function useCapitalFlow(workspaceId: string, domainId?: string, entityId?: string, matchType?: string, limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<{ data: any[]; count: number }>(
    workspaceId ? `/api/capital-flow?workspace_id=${workspaceId}&domain_id=${domainId || ''}${entityId ? `&entity_id=${entityId}` : ''}${matchType ? `&match_type=${matchType}` : ''}&limit=${limit}` : null,
    fetcher
  )
  return {
    mappings: (data?.data as any[]) || [],
    count: data?.count || 0,
    isLoading,
    error,
    mutate
  }
}

export function useCapitalDirectory(workspaceId: string, entityType?: string, activityStatus?: string, limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<{ data: any[]; count: number }>(
    workspaceId ? `/api/capital-directory?workspace_id=${workspaceId}${entityType ? `&entity_type=${entityType}` : ''}${activityStatus ? `&activity_status=${activityStatus}` : ''}&limit=${limit}` : null,
    fetcher
  )
  return {
    entities: (data?.data as any[]) || [],
    count: data?.count || 0,
    isLoading,
    error,
    mutate
  }
}

export function useQualitySnapshots(workspaceId: string, domainId?: string, limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<{ snapshots: any[]; recentRuns: any[]; count: number }>(
    workspaceId ? `/api/quality?workspace_id=${workspaceId}&domain_id=${domainId || ''}&limit=${limit}` : null,
    fetcher
  )
  return {
    snapshots: (data?.snapshots as any[]) || [],
    recentRuns: (data?.recentRuns as any[]) || [],
    count: data?.count || 0,
    isLoading,
    error,
    mutate
  }
}

export function useEvidenceReviewQueue(workspaceId: string, domainId?: string, status?: string, limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<{ data: any[]; count: number }>(
    workspaceId ? `/api/evidence-review?workspace_id=${workspaceId}&domain_id=${domainId || ''}${status ? `&status=${status}` : ''}&limit=${limit}` : null,
    fetcher
  )
  return {
    queue: (data?.data as any[]) || [],
    count: data?.count || 0,
    isLoading,
    error,
    mutate
  }
}

export function useInvestments(workspaceId: string, domainId?: string, limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<{ data: any[]; count: number }>(
    workspaceId ? `/api/investments?workspace_id=${workspaceId}&domain_id=${domainId || ''}&limit=${limit}` : null,
    fetcher
  )
  return {
    investments: (data?.data as any[]) || [],
    count: data?.count || 0,
    isLoading,
    error,
    mutate
  }
}