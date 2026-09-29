import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single()

    if (!workspaceMember) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get all available domains
    const { data: domains, error: domainsError } = await supabase
      .from('domains')
      .select('id, key, name, description')
      .eq('is_active', true)
      .order('name')

    if (domainsError) throw domainsError

    // Get current workspace_domain
    const { data: workspaceDomain, error: wdError } = await supabase
      .from('workspace_domains')
      .select(`
        *,
        domain:domains (id, key, name, description)
      `)
      .eq('workspace_id', workspaceMember.workspace_id)
      .eq('status', 'active')
      .single()

    // If no active domain, check for any domain
    let currentDomain = workspaceDomain
    if (!currentDomain) {
      const { data: anyDomain } = await supabase
        .from('workspace_domains')
        .select(`
          *,
          domain:domains (id, key, name, description)
        `)
        .eq('workspace_id', workspaceMember.workspace_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      currentDomain = anyDomain
    }

    return NextResponse.json({ 
      domains: domains || [],
      current_domain: currentDomain,
      workspace_id: workspaceMember.workspace_id
    })
  } catch (error) {
    console.error('Get workspace domain error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { domain_id, domain_key } = await request.json()

    if (!domain_id && !domain_key) {
      return NextResponse.json({ error: 'domain_id or domain_key required' }, { status: 400 })
    }

    // Get user's workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single()

    if (!workspaceMember) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Resolve domain
    let domainId = domain_id
    if (!domainId && domain_key) {
      const { data: domain } = await supabase
        .from('domains')
        .select('id')
        .eq('key', domain_key)
        .single()
      if (!domain) {
        return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
      }
      domainId = domain.id
    }

    // Deactivate any existing active domain for this workspace
    await supabase
      .from('workspace_domains')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceMember.workspace_id)
      .eq('status', 'active')

    // Create or update workspace_domain
    const { data: workspaceDomain, error: wdError } = await supabase
      .from('workspace_domains')
      .upsert({
        workspace_id: workspaceMember.workspace_id,
        domain_id: domainId,
        status: 'active',
        created_by: user.id,
      }, {
        onConflict: 'workspace_id,domain_id'
      })
      .select(`
        *,
        domain:domains (id, key, name, description)
      `)
      .single()

    if (wdError) throw wdError

    return NextResponse.json({ workspace_domain: workspaceDomain })
  } catch (error) {
    console.error('Update workspace domain error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}