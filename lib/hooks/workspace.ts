'use client'

import useSWR from 'swr'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useWorkspace() {
  const configured = hasSupabaseConfig()
  const { data, error, isLoading, mutate } = useSWR(configured ? '/api/workspace/current' : null, fetcher)
  
  return {
    workspace: data?.workspace,
    workspaceDomain: data?.workspace_domain,
    domain: data?.domain,
    isLoading: configured && isLoading,
    error,
    mutate,
  }
}

export function useCurrentUser() {
  const configured = hasSupabaseConfig()
  const { data, error, isLoading, mutate } = useSWR(configured ? '/api/auth/user' : null, fetcher)
  
  return {
    user: data?.user,
    profile: data?.profile,
    isLoading: configured && isLoading,
    error,
    mutate,
  }
}

export async function getWorkspaceId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null
  
  const { data: workspaceMember } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .single()
  
  return workspaceMember?.workspace_id || null
}

export async function getActiveWorkspaceDomain(workspaceId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('workspace_domains')
    .select(`
      *,
      domain:domains (*)
    `)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .single()
  
  return data
}
