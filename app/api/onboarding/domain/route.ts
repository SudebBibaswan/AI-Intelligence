import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: domains, error } = await supabase
      .from('domains')
      .select('key, name, description')
      .eq('is_active', true)
      .order('name')

    if (error) throw error

    return NextResponse.json({ domains: domains ?? [] })
  } catch (error) {
    console.error('List onboarding domains error:', error)
    return NextResponse.json({ error: 'Failed to load domains' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { domain_key } = await request.json()
    
    if (!domain_key) {
      return NextResponse.json({ error: 'domain_key required' }, { status: 400 })
    }

    // Get the domain ID from the key
    const { data: domain, error: domainError } = await supabase
      .from('domains')
      .select('id, name')
      .eq('key', domain_key)
      .eq('is_active', true)
      .single()

    if (domainError || !domain) {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
    }

    // Get user's workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .single()

    if (!workspaceMember) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    const workspaceId = workspaceMember.workspace_id

    const { error: pauseError } = await supabase
      .from('workspace_domains')
      .update({ status: 'paused' })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .neq('domain_id', domain.id)

    if (pauseError) throw pauseError

    const { data: existing, error: existingError } = await supabase
      .from('workspace_domains')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('domain_id', domain.id)
      .neq('status', 'archived')
      .order('created_at')
      .limit(1)
      .maybeSingle()

    if (existingError) throw existingError

    const mutation = existing
      ? supabase
          .from('workspace_domains')
          .update({ name: domain.name, status: 'active' })
          .eq('id', existing.id)
          .eq('workspace_id', workspaceId)
      : supabase
          .from('workspace_domains')
          .insert({
            workspace_id: workspaceId,
            domain_id: domain.id,
            name: domain.name,
            status: 'active',
            created_by: user.id,
          })

    const { data: workspaceDomain, error: wdError } = await mutation
      .select('id')
      .single()

    if (wdError) throw wdError

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ onboarding_state: 'in_progress' })
      .eq('user_id', user.id)

    if (profileError) throw profileError

    return NextResponse.json({
      workspace_domain_id: workspaceDomain.id,
      workspace_id: workspaceId,
    })
  } catch (error) {
    console.error('Onboarding domain error:', error)
    return NextResponse.json({ error: 'Failed to save domain' }, { status: 500 })
  }
}
